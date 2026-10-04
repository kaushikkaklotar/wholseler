import { BadRequestException, Body, Controller, Delete, Get, Inject, Injectable, Module, NotFoundException, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { productSchema, stockSchema, type ProductInput, type SessionUser } from "@wholesale/shared";
import { Ability, AuthModule, type AuthRequest, SessionGuard } from "./auth";
import { Database, audit, notify } from "./database";
import { parse } from "./validation";
const productInclude={variants:{where:{archived:false},orderBy:{size:"asc" as const}},images:{select:{id:true}}} satisfies Prisma.ProductInclude;
export const mapProduct=<T extends {variants:{stock:number}[];images:{id:string}[]}>(p:T)=>({...p,stock:p.variants.reduce((s,v)=>s+v.stock,0),images:p.images.map(i=>({id:i.id,url:`/api/v1/media/${i.id}`}))});
@Injectable()
export class CatalogService {
  constructor(@Inject(Database) private readonly db:Database){}
  async list(actor:SessionUser,q="",category=""){
    const where:Prisma.ProductWhereInput={businessId:actor.businessId!,moderation:{not:"ARCHIVED"},...(q?{OR:[{name:{contains:q,mode:"insensitive"}},{sku:{contains:q,mode:"insensitive"}},{tags:{has:q}}]}:{}),...(category?{category}:{})};
    const [products,total,allCount]=await Promise.all([this.db.product.findMany({where,include:productInclude,orderBy:{createdAt:"desc"},take:500}),this.db.product.count({where}),this.db.product.count({where:{businessId:actor.businessId!,moderation:{not:"ARCHIVED"}}})]);
    return {products:products.map(mapProduct),total,allCount,limit:actor.plan!.productLimit};
  }
  async one(actor:SessionUser,id:string){const product=await this.db.product.findFirst({where:{id,businessId:actor.businessId!},include:productInclude});if(!product)throw new NotFoundException("Product not found");return mapProduct(product);}
  async checkCap(tx:Prisma.TransactionClient,businessId:string,additional:number){const business=await tx.business.update({where:{id:businessId},data:{revision:{increment:1}},include:{plan:true}});const count=await tx.product.count({where:{businessId,moderation:{not:"ARCHIVED"}}});if(count+additional>business.plan.productLimit)throw new BadRequestException(`Your ${business.plan.name} plan allows ${business.plan.productLimit} products. Ask the platform team to upgrade your plan`);}
  async attach(tx:Prisma.TransactionClient,actor:SessionUser,productId:string,imageIds:string[]){
    if(imageIds.length){const images=await tx.upload.findMany({where:{id:{in:imageIds},businessId:actor.businessId!,kind:"PRODUCT",OR:[{productId:null},{productId}]}});if(images.length!==new Set(imageIds).size)throw new BadRequestException("One or more images do not belong to this product");}
    await tx.upload.updateMany({where:{productId,businessId:actor.businessId!,id:{notIn:imageIds}},data:{productId:null}});
    if(imageIds.length)await tx.upload.updateMany({where:{id:{in:imageIds},businessId:actor.businessId!},data:{productId}});
  }
  async insert(tx:Prisma.TransactionClient,actor:SessionUser,input:ProductInput){
    const {variants,imageIds,...data}=input;
    const product=await tx.product.create({data:{...data,businessId:actor.businessId!,variants:{create:variants.map(v=>({businessId:actor.businessId!,size:v.size,color:v.color,stock:v.stock,lowStockAt:v.lowStockAt}))}},include:{variants:true}});
    const opening=product.variants.filter(v=>v.stock>0).map(v=>({businessId:actor.businessId!,productId:product.id,variantId:v.id,actorId:actor.id,type:"OPENING" as const,quantity:v.stock,balanceAfter:v.stock,note:"Opening stock on catalog creation"}));
    if(opening.length)await tx.stockMovement.createMany({data:opening});
    await this.attach(tx,actor,product.id,imageIds);await audit(tx,actor.id,actor.businessId,"PRODUCT_CREATED",product.id,`${product.sku} · ${product.name}`);return product;
  }
  async create(actor:SessionUser,body:unknown){const input=parse(productSchema,body);if(input.variants.some(v=>v.stock>0)&&!actor.permissions.includes("INVENTORY:CREATE"))throw new BadRequestException("Opening stock requires inventory create permission");return this.db.serial(async tx=>{await this.checkCap(tx,actor.businessId!,1);return this.insert(tx,actor,input);});}
  async update(actor:SessionUser,id:string,body:unknown){
    const input=parse(productSchema,body);
    return this.db.serial(async tx=>{
      const existing=await tx.product.findFirst({where:{id,businessId:actor.businessId!,moderation:{not:"ARCHIVED"}},include:{variants:true}});if(!existing)throw new NotFoundException("Product not found");
      const {variants,imageIds,...data}=input;
      for(const variant of variants){
        if(variant.id){const old=existing.variants.find(v=>v.id===variant.id&&!v.archived);if(!old)throw new BadRequestException("Variant does not belong to this product");if(variant.stock!==old.stock)throw new BadRequestException("Stock changed. Refresh the product, and use inventory to adjust stock");await tx.variant.update({where:{id:old.id},data:{size:variant.size,color:variant.color,lowStockAt:variant.lowStockAt}});}
        else{if(variant.stock!==0)throw new BadRequestException("New variants start at zero. Add their stock through inventory");await tx.variant.create({data:{businessId:actor.businessId!,productId:id,size:variant.size,color:variant.color,lowStockAt:variant.lowStockAt}});}
      }
      const omitted=existing.variants.filter(v=>!v.archived&&!variants.some(n=>n.id===v.id));if(omitted.some(v=>v.stock!==0))throw new BadRequestException("Move stock out before removing a variant");if(omitted.length)await tx.variant.updateMany({where:{id:{in:omitted.map(v=>v.id)},businessId:actor.businessId!},data:{archived:true}});
      const product=await tx.product.update({where:{id},data:{...data,moderation:"PENDING",moderationNote:""}});await this.attach(tx,actor,id,imageIds);await audit(tx,actor.id,actor.businessId,"PRODUCT_UPDATED",id,"Catalog changes submitted for review");return product;
    });
  }
  async archive(actor:SessionUser,id:string){return this.db.serial(async tx=>{const result=await tx.product.updateMany({where:{id,businessId:actor.businessId!,moderation:{not:"ARCHIVED"}},data:{moderation:"ARCHIVED"}});if(!result.count)throw new NotFoundException("Product not found");await audit(tx,actor.id,actor.businessId,"PRODUCT_ARCHIVED",id,"Archived from catalog and discovery");return {ok:true};});}
  async duplicate(actor:SessionUser,id:string){const source=await this.one(actor,id);return this.create(actor,{...source,id:undefined,name:`${source.name} (copy)`,sku:`${source.sku.slice(0,27)}-${Date.now().toString(36)}`,imageIds:[],variants:source.variants.map(v=>({...v,id:undefined,stock:0}))});}
  async import(actor:SessionUser,body:unknown){
    const input=parse(z.object({products:z.array(productSchema).min(1).max(500)}),body);if(!actor.plan?.bulkImport)throw new BadRequestException("Bulk import is included in Growth and Pro plans");
    if(!actor.permissions.includes("INVENTORY:CREATE")&&input.products.some(p=>p.variants.some(v=>v.stock>0)))throw new BadRequestException("Opening stock requires inventory create permission");
    if(new Set(input.products.map(p=>p.sku)).size!==input.products.length)throw new BadRequestException("Group all variants under one product SKU");
    return this.db.serial(async tx=>{await this.checkCap(tx,actor.businessId!,input.products.length);for(const p of input.products)await this.insert(tx,actor,p);await audit(tx,actor.id,actor.businessId,"BULK_IMPORT",actor.businessId!,`${input.products.length} products imported`);return {created:input.products.length};});
  }
}
@Controller("v1/products") @UseGuards(SessionGuard)
export class CatalogController {
  constructor(@Inject(CatalogService) private readonly catalog:CatalogService){}
  @Get() @Ability("PRODUCTS","VIEW") list(@Req()req:AuthRequest,@Query("q")q?:string,@Query("category")category?:string){return this.catalog.list(req.actor,q?.slice(0,100),category?.slice(0,80));}
  @Get(":id") @Ability("PRODUCTS","VIEW") one(@Req()req:AuthRequest,@Param("id")id:string){return this.catalog.one(req.actor,id);}
  @Post() @Ability("PRODUCTS","CREATE") create(@Req()req:AuthRequest,@Body()body:unknown){return this.catalog.create(req.actor,body);}
  @Post("import") @Ability("PRODUCTS","CREATE") import(@Req()req:AuthRequest,@Body()body:unknown){return this.catalog.import(req.actor,body);}
  @Post(":id/duplicate") @Ability("PRODUCTS","CREATE") duplicate(@Req()req:AuthRequest,@Param("id")id:string){return this.catalog.duplicate(req.actor,id);}
  @Patch(":id") @Ability("PRODUCTS","EDIT") update(@Req()req:AuthRequest,@Param("id")id:string,@Body()body:unknown){return this.catalog.update(req.actor,id,body);}
  @Delete(":id") @Ability("PRODUCTS","DELETE") archive(@Req()req:AuthRequest,@Param("id")id:string){return this.catalog.archive(req.actor,id);}
}
@Injectable()
export class InventoryService {
  constructor(@Inject(Database) private readonly db:Database){}
  async list(actor:SessionUser,q="",low=false){const variants=await this.db.variant.findMany({where:{businessId:actor.businessId!,archived:false,product:{moderation:{not:"ARCHIVED"},...(q?{OR:[{name:{contains:q,mode:"insensitive"}},{sku:{contains:q,mode:"insensitive"}}]}:{})}},include:{product:{select:{id:true,name:true,sku:true,category:true,pricePaise:true,images:{take:1,select:{id:true}}}}},orderBy:[{stock:"asc"},{createdAt:"desc"}],take:2000});const lowCount=variants.filter(v=>v.stock<=v.lowStockAt).length;return {variants:low?variants.filter(v=>v.stock<=v.lowStockAt):variants,totalUnits:variants.reduce((s,v)=>s+v.stock,0),lowCount,stockValuePaise:variants.reduce((s,v)=>s+v.stock*v.product.pricePaise,0)};}
  async ledger(actor:SessionUser,variantId?:string,page=1){const where={businessId:actor.businessId!,...(variantId?{variantId}:{})};const [movements,total]=await Promise.all([this.db.stockMovement.findMany({where,include:{product:{select:{name:true,sku:true}},variant:{select:{size:true,color:true}},actor:{select:{name:true}}},orderBy:[{createdAt:"desc"},{id:"desc"}],take:50,skip:(page-1)*50}),this.db.stockMovement.count({where})]);return {movements,total,page};}
  async move(actor:SessionUser,body:unknown){const input=parse(stockSchema,body);return this.db.serial(async tx=>{
    const already=await tx.stockMovement.findUnique({where:{businessId_requestKey:{businessId:actor.businessId!,requestKey:input.requestKey}}});if(already){if(already.variantId!==input.variantId||already.quantity!==input.quantity||already.type!==input.type||already.note!==input.note)throw new BadRequestException("Request key was already used for a different stock movement");return already;}
    const variant=await tx.variant.findFirst({where:{id:input.variantId,businessId:actor.businessId!,archived:false,product:{moderation:{not:"ARCHIVED"}}},include:{product:true}});if(!variant)throw new NotFoundException("Variant not found");
    const updated=await tx.variant.updateMany({where:{id:variant.id,businessId:actor.businessId!,stock:{gte:Math.max(0,-input.quantity)}},data:{stock:{increment:input.quantity}}});if(!updated.count)throw new BadRequestException("Stock cannot become negative");
    const balance=(await tx.variant.findUniqueOrThrow({where:{id:variant.id}})).stock;
    const movement=await tx.stockMovement.create({data:{businessId:actor.businessId!,productId:variant.productId,variantId:variant.id,actorId:actor.id,type:input.type,quantity:input.quantity,balanceAfter:balance,note:input.note,requestKey:input.requestKey}});
    await audit(tx,actor.id,actor.businessId,"STOCK_MOVEMENT",movement.id,`${variant.product.sku} · ${input.quantity>0?"+":""}${input.quantity} · ${input.note}`);
    if(balance<=variant.lowStockAt&&variant.stock>variant.lowStockAt)await notify(tx,actor.businessId,null,"Low stock",`${variant.product.name} · ${variant.size}/${variant.color}: ${balance} units left`,"/dashboard/inventory");return movement;
  });}
}
@Controller("v1/inventory") @UseGuards(SessionGuard)
export class InventoryController {
  constructor(@Inject(InventoryService) private readonly inventory:InventoryService){}
  @Get() @Ability("INVENTORY","VIEW") list(@Req()req:AuthRequest,@Query("q")q?:string,@Query("low")low?:string){return this.inventory.list(req.actor,q?.slice(0,100),low==="true");}
  @Get("ledger") @Ability("INVENTORY","VIEW") ledger(@Req()req:AuthRequest,@Query("variantId")id?:string,@Query("page")page?:string){return this.inventory.ledger(req.actor,id,Math.min(10000,Math.max(1,Number(page)||1)));}
  @Post("movements") @Ability("INVENTORY","EDIT") move(@Req()req:AuthRequest,@Body()body:unknown){return this.inventory.move(req.actor,body);}
}
@Module({imports:[AuthModule],providers:[CatalogService,InventoryService],controllers:[CatalogController,InventoryController],exports:[CatalogService,InventoryService]})
export class CatalogModule {}
