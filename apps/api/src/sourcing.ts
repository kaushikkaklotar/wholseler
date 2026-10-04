import { BadRequestException, Body, Controller, Get, Inject, Injectable, Module, NotFoundException, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { inquirySchema, paymentState, type SessionUser } from "@wholesale/shared";
import { Ability, AllowRoles, AuthModule, type AuthRequest, SessionGuard } from "./auth";
import { Database, audit, notify } from "./database";
import { parse } from "./validation";
const publicInclude={business:{select:{id:true,name:true,city:true,marketArea:true,phone:true,address:true,categories:true,moq:true,deliveryInfo:true,description:true,verificationStatus:true}},variants:{where:{archived:false},select:{id:true,size:true,color:true,stock:true}},images:{select:{id:true}}} satisfies Prisma.ProductInclude;
type PublicProduct=Prisma.ProductGetPayload<{include:typeof publicInclude}>;
@Injectable()
export class SourcingService {
  constructor(@Inject(Database) private readonly db:Database){}
  private serialize(p:PublicProduct,approved:Set<string>,favorites:Set<string>){const show=p.visibility==="PUBLIC"||(p.visibility==="APPROVED_SELLERS"&&approved.has(p.businessId));return {id:p.id,name:p.name,sku:p.sku,category:p.category,description:p.description,moq:p.moq,cartonUnits:p.cartonUnits,tags:p.tags,createdAt:p.createdAt,visibility:p.visibility,pricePaise:show?p.pricePaise:null,cartonPricePaise:show?p.cartonPricePaise:null,priceAvailable:show,stock:p.variants.reduce((s,v)=>s+v.stock,0),variants:p.variants,images:p.images.map(i=>({id:i.id,url:`/api/v1/media/${i.id}`})),business:p.business,favorite:favorites.has(p.id),activity:p.soldUnits+p.viewCount};}
  async discover(actor:SessionUser,query:Record<string,string|undefined>){
    const sellerId=actor.sellerId;if(!sellerId)throw new BadRequestException("Complete your seller profile first");
    const [access,favorites]=await Promise.all([this.db.sellerAccess.findMany({where:{sellerId,approved:true},select:{businessId:true}}),this.db.favorite.findMany({where:{sellerId},select:{productId:true}})]);
    const approved=new Set(access.map(a=>a.businessId)),favoriteIds=new Set(favorites.map(f=>f.productId));
    let ids:string[]|undefined;const q=query.q?.trim().slice(0,100);
    if(q){const matches=await this.db.$queryRaw<{id:string}[]>`SELECT p.id FROM "Product" p JOIN "Business" b ON p."businessId"=b.id WHERE p.moderation='APPROVED' AND b."verificationStatus"='VERIFIED' AND (to_tsvector('simple',p.name || ' ' || p.sku || ' ' || p.category || ' ' || b.name || ' ' || b."marketArea") @@ websearch_to_tsquery('simple',${q}) OR p.name ILIKE ${`%${q}%`} OR p.sku ILIKE ${`%${q}%`} OR b.name ILIKE ${`%${q}%`}) LIMIT 1000`;ids=matches.map(m=>m.id);}
    const where:Prisma.ProductWhereInput={moderation:"APPROVED",business:{verificationStatus:"VERIFIED",...(query.city?{city:{contains:query.city.slice(0,80),mode:"insensitive"}}:{}),...(query.market?{marketArea:{contains:query.market.slice(0,100),mode:"insensitive"}}:{})},...(ids?{id:{in:ids}}:{}),...(query.category?{category:query.category.slice(0,80)}:{}),...(query.favorites==="true"?{favorites:{some:{sellerId}}}:{}),...(query.inStock==="true"?{variants:{some:{archived:false,stock:{gt:0}}}}:{})};
    const [products,supplierCount]=await Promise.all([this.db.product.findMany({where,include:publicInclude,orderBy:query.sort==="trending"?[{soldUnits:"desc"},{viewCount:"desc"}]:{createdAt:"desc"},take:500}),this.db.business.count({where:{verificationStatus:"VERIFIED"}})]);
    let safe=products.map(p=>this.serialize(p,approved,favoriteIds));
    const min=Number(query.minPrice),max=Number(query.maxPrice);if(query.minPrice&&Number.isFinite(min))safe=safe.filter(p=>p.pricePaise!==null&&p.pricePaise>=min*100);if(query.maxPrice&&Number.isFinite(max))safe=safe.filter(p=>p.pricePaise!==null&&p.pricePaise<=max*100);
    if(query.sort==="price")safe.sort((a,b)=>(a.pricePaise??Number.MAX_SAFE_INTEGER)-(b.pricePaise??Number.MAX_SAFE_INTEGER));
    const page=Math.min(100,Math.max(1,Number(query.page)||1));return {products:safe.slice((page-1)*24,page*24),total:safe.length,supplierCount,page};
  }
  async one(actor:SessionUser,id:string){const product=await this.db.product.findFirst({where:{id,moderation:"APPROVED",business:{verificationStatus:"VERIFIED"}},include:publicInclude});if(!product)throw new NotFoundException("Product is not available for sourcing");const [access,favorite]=await Promise.all([this.db.sellerAccess.findUnique({where:{businessId_sellerId:{businessId:product.businessId,sellerId:actor.sellerId!}}}),this.db.favorite.findUnique({where:{sellerId_productId:{sellerId:actor.sellerId!,productId:id}}})]);await this.db.product.update({where:{id},data:{viewCount:{increment:1}}});return this.serialize(product,new Set(access?.approved?[product.businessId]:[]),new Set(favorite?[id]:[]));}
  async favorite(actor:SessionUser,id:string,body:unknown){const input=parse(z.object({favorite:z.boolean()}),body);const product=await this.db.product.findFirst({where:{id,moderation:"APPROVED",business:{verificationStatus:"VERIFIED"}}});if(!product)throw new NotFoundException("Product not found");if(input.favorite)await this.db.favorite.upsert({where:{sellerId_productId:{sellerId:actor.sellerId!,productId:id}},create:{sellerId:actor.sellerId!,productId:id},update:{}});else await this.db.favorite.deleteMany({where:{sellerId:actor.sellerId!,productId:id}});return {favorite:input.favorite};}
  async contact(actor:SessionUser,body:unknown){const input=parse(inquirySchema,body);return this.db.serial(async tx=>{
    const old=await tx.inquiry.findUnique({where:{requestKey:input.requestKey}});if(old&&(old.sellerId!==actor.sellerId||old.productId!==input.productId||old.quantity!==input.quantity||old.note!==input.note||old.channel!==input.channel))throw new BadRequestException("Inquiry request key was already used");
    const product=await tx.product.findFirst({where:{id:input.productId,moderation:"APPROVED",business:{verificationStatus:"VERIFIED"}},include:{business:true}});if(!product)throw new NotFoundException("Product is no longer available");if(input.quantity<product.moq)throw new BadRequestException(`Minimum order quantity is ${product.moq} units`);
    const inquiry=old||await tx.inquiry.create({data:{...input,businessId:product.businessId,sellerId:actor.sellerId!}});
    if(!old){await notify(tx,product.businessId,null,"New sourcing inquiry",`${actor.name} asked for ${input.quantity} units of ${product.name}`,"/dashboard/buyers");await audit(tx,actor.id,product.businessId,"SELLER_CONTACT",inquiry.id,`${product.sku} · ${input.channel}`);}
    const message=`Hello ${product.business.name}, I am ${actor.name}. I am interested in ${product.name} (SKU ${product.sku}), ${input.quantity} units. ${input.note}\nReference: ${process.env.WEB_ORIGIN}/seller/products/${product.id}`;
    return {inquiryId:inquiry.id,href:input.channel==="CALL"?`tel:+91${product.business.phone}`:`https://wa.me/91${product.business.phone}?text=${encodeURIComponent(message)}`};
  });}
  async inquiries(actor:SessionUser){return this.db.inquiry.findMany({where:{sellerId:actor.sellerId!},include:{product:{select:{id:true,name:true,sku:true}},business:{select:{name:true,phone:true,marketArea:true}}},orderBy:{createdAt:"desc"},take:200});}
  async suppliers(actor:SessionUser){const shops=await this.db.business.findMany({where:{verificationStatus:"VERIFIED"},select:{id:true,name:true,city:true,marketArea:true,address:true,phone:true,categories:true,moq:true,deliveryInfo:true,description:true,verificationStatus:true,_count:{select:{products:{where:{moderation:"APPROVED"}}}}},orderBy:{name:"asc"},take:200});return shops;}
  async buyers(actor:SessionUser){
    const [inquiries,invoices,access]=await Promise.all([this.db.inquiry.findMany({where:{businessId:actor.businessId!},include:{seller:{include:{user:{select:{name:true,phone:true}}}},product:{select:{id:true,name:true,sku:true}},invoice:{select:{id:true,number:true}}},orderBy:{createdAt:"desc"},take:500}),this.db.invoice.findMany({where:{businessId:actor.businessId!},orderBy:{createdAt:"desc"},take:2000}),this.db.sellerAccess.findMany({where:{businessId:actor.businessId!}})]);
    const groups=new Map<string,{name:string;phone:string;invoiceCount:number;salesPaise:number;duePaise:number;lastPurchase:Date;invoices:{id:string;number:string;createdAt:Date;totalPaise:number;duePaise:number}[]}>();
    for(const i of invoices){const state=paymentState(i.totalPaise,i.returnedPaise,i.paidPaise,i.status==="CANCELLED");let buyer=groups.get(i.buyerPhone);if(!buyer){buyer={name:i.buyerName,phone:i.buyerPhone,invoiceCount:0,salesPaise:0,duePaise:0,lastPurchase:i.createdAt,invoices:[]};groups.set(i.buyerPhone,buyer);}if(i.status!=="CANCELLED"){buyer.invoiceCount++;buyer.salesPaise+=state.netPaise;buyer.duePaise+=state.duePaise;}buyer.invoices.push({id:i.id,number:i.number,createdAt:i.createdAt,totalPaise:state.netPaise,duePaise:state.duePaise});}
    return {buyers:[...groups.values()],inquiries:inquiries.map(i=>({...i,priceAccess:access.some(a=>a.sellerId===i.sellerId&&a.approved)}))};
  }
  async updateInquiry(actor:SessionUser,id:string,body:unknown){const input=parse(z.object({status:z.enum(["NEW","CONTACTED","QUOTED","WON","LOST"]),ownerNote:z.string().trim().max(500).default("")}),body);return this.db.serial(async tx=>{const old=await tx.inquiry.findFirst({where:{id,businessId:actor.businessId!}});if(!old)throw new NotFoundException("Inquiry not found");const result=await tx.inquiry.update({where:{id},data:input});await notify(tx,null,(await tx.seller.findUniqueOrThrow({where:{id:old.sellerId}})).userId,"Inquiry updated",`Your sourcing inquiry is now ${input.status.toLowerCase()}`,"/seller/inquiries");await audit(tx,actor.id,actor.businessId,"INQUIRY_UPDATED",id,input.status);return result;});}
  async grant(actor:SessionUser,sellerId:string,body:unknown){const input=parse(z.object({approved:z.boolean()}),body);const seller=await this.db.seller.findUnique({where:{id:sellerId}});if(!seller)throw new NotFoundException("Seller not found");return this.db.serial(async tx=>{const result=await tx.sellerAccess.upsert({where:{businessId_sellerId:{businessId:actor.businessId!,sellerId}},create:{businessId:actor.businessId!,sellerId,approved:input.approved},update:{approved:input.approved}});await audit(tx,actor.id,actor.businessId,"SELLER_PRICE_ACCESS",sellerId,input.approved?"Approved private pricing":"Revoked private pricing");return result;});}
}
@Controller("v1/seller") @UseGuards(SessionGuard) @AllowRoles("SELLER")
export class SellerController {
  constructor(@Inject(SourcingService) private readonly service:SourcingService){}
  @Get("discover") discover(@Req()req:AuthRequest,@Query()query:Record<string,string|undefined>){return this.service.discover(req.actor,query);}
  @Get("products/:id") product(@Req()req:AuthRequest,@Param("id")id:string){return this.service.one(req.actor,id);}
  @Post("products/:id/favorite") favorite(@Req()req:AuthRequest,@Param("id")id:string,@Body()body:unknown){return this.service.favorite(req.actor,id,body);}
  @Post("contact") contact(@Req()req:AuthRequest,@Body()body:unknown){return this.service.contact(req.actor,body);}
  @Get("inquiries") inquiries(@Req()req:AuthRequest){return this.service.inquiries(req.actor);}
  @Get("suppliers") suppliers(@Req()req:AuthRequest){return this.service.suppliers(req.actor);}
}
@Controller("v1/buyers") @UseGuards(SessionGuard)
export class BuyersController {
  constructor(@Inject(SourcingService) private readonly service:SourcingService){}
  @Get() @Ability("SELLERS","VIEW") buyers(@Req()req:AuthRequest){return this.service.buyers(req.actor);}
  @Patch("inquiries/:id") @Ability("SELLERS","EDIT") update(@Req()req:AuthRequest,@Param("id")id:string,@Body()body:unknown){return this.service.updateInquiry(req.actor,id,body);}
  @Post("price-access/:id") @Ability("SELLERS","EDIT") grant(@Req()req:AuthRequest,@Param("id")id:string,@Body()body:unknown){return this.service.grant(req.actor,id,body);}
}
@Module({imports:[AuthModule],providers:[SourcingService],controllers:[SellerController,BuyersController]})
export class SourcingModule {}
