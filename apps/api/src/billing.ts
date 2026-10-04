import { BadRequestException, Body, Controller, Get, Inject, Injectable, Module, NotFoundException, Param, Post, Query, Req, Res, UseGuards } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { Response } from "express";
import { invoiceSchema, invoiceTotals, paymentSchema, paymentState, returnSchema, returnValue, splitLineTotals, type SessionUser } from "@wholesale/shared";
import { Ability, AuthModule, type AuthRequest, SessionGuard } from "./auth";
import { Database, audit, notify } from "./database";
import { parse } from "./validation";
export function invoiceOutput<T extends {totalPaise:number;returnedPaise:number;paidPaise:number;status:string}>(invoice:T){return {...invoice,...paymentState(invoice.totalPaise,invoice.returnedPaise,invoice.paidPaise,invoice.status==="CANCELLED")};}
export const invoiceInclude={items:true,actor:{select:{name:true}},payments:{orderBy:{createdAt:"desc" as const}},returns:{include:{items:true},orderBy:{createdAt:"desc" as const}}} satisfies Prisma.InvoiceInclude;
export function csvCell(value:unknown){const raw=String(value??"");return `"${(/^[=+\-@\t\r]/.test(raw)?"'":"")+raw.replaceAll('"','""')}"`;}
export function csv(rows:unknown[][]){return "\uFEFF"+rows.map(r=>r.map(csvCell).join(",")).join("\r\n");}
@Injectable()
export class BillingService {
  constructor(@Inject(Database) private readonly db:Database){}
  async list(actor:SessionUser,q="",from?:string,to?:string){const range:Prisma.DateTimeFilter={...(from?{gte:new Date(`${from}T00:00:00+05:30`)}:{}),...(to?{lt:new Date(new Date(`${to}T00:00:00+05:30`).getTime()+86400000)}:{})};const where:Prisma.InvoiceWhereInput={businessId:actor.businessId!,...(q?{OR:[{number:{contains:q,mode:"insensitive"}},{buyerName:{contains:q,mode:"insensitive"}},{buyerPhone:{contains:q}}]}:{}),...((from||to)?{createdAt:range}:{})};const invoices=await this.db.invoice.findMany({where,include:{items:true,actor:{select:{name:true}}},orderBy:{createdAt:"desc"},take:500});return {invoices:invoices.map(invoiceOutput)};}
  async one(actor:SessionUser,id:string){const invoice=await this.db.invoice.findFirst({where:{id,businessId:actor.businessId!},include:invoiceInclude});if(!invoice)throw new NotFoundException("Invoice not found");return invoiceOutput(invoice);}
  async variants(actor:SessionUser,q=""){return this.db.variant.findMany({where:{businessId:actor.businessId!,archived:false,stock:{gt:0},product:{moderation:{not:"ARCHIVED"},...(q?{OR:[{name:{contains:q,mode:"insensitive"}},{sku:{contains:q,mode:"insensitive"}}]}:{})}},include:{product:{select:{id:true,name:true,sku:true,pricePaise:true,moq:true,images:{take:1,select:{id:true}}}}},orderBy:{product:{name:"asc"}},take:500});}
  async create(actor:SessionUser,body:unknown){
    const input=parse(invoiceSchema,body);const totals=invoiceTotals(input.items,input.discountPaise,input.taxRateBps);if(input.paidPaise>totals.totalPaise)throw new BadRequestException("Received payment cannot exceed the invoice total");
    const requestHash=createHash("sha256").update(JSON.stringify(input)).digest("hex");
    return this.db.serial(async tx=>{
      const already=await tx.invoice.findUnique({where:{businessId_requestKey:{businessId:actor.businessId!,requestKey:input.requestKey}},include:invoiceInclude});if(already){if(already.requestHash!==requestHash)throw new BadRequestException("This invoice request key was already used with different data");return invoiceOutput(already);}
      const business=await tx.business.update({where:{id:actor.businessId!},data:{invoiceCounter:{increment:1},revision:{increment:1}}});
      if(input.taxMode!=="NONE"&&!business.gstNumber)throw new BadRequestException("Add your business GSTIN before issuing a GST invoice");
      const variants=await tx.variant.findMany({where:{id:{in:input.items.map(i=>i.variantId)},businessId:business.id,archived:false,product:{moderation:{not:"ARCHIVED"}}},include:{product:true}});if(variants.length!==input.items.length)throw new BadRequestException("An invoice item is unavailable or does not belong to your business");
      if(input.inquiryId){const inquiry=await tx.inquiry.findFirst({where:{id:input.inquiryId,businessId:business.id,seller:{user:{phone:input.buyerPhone}}}});if(!inquiry)throw new BadRequestException("The selected inquiry does not match this buyer");}
      const number=`${business.invoicePrefix}-${new Intl.DateTimeFormat("en-IN",{year:"2-digit",timeZone:"Asia/Kolkata"}).format(new Date())}-${String(business.invoiceCounter).padStart(5,"0")}`;
      const lineTotals=splitLineTotals(input.items,totals.totalPaise);
      const invoice=await tx.invoice.create({data:{businessId:business.id,actorId:actor.id,number,requestKey:input.requestKey,requestHash,buyerName:input.buyerName,buyerPhone:input.buyerPhone,buyerAddress:input.buyerAddress,buyerGst:input.buyerGst,businessSnapshot:{name:business.name,phone:business.phone,address:business.address,city:business.city,gstNumber:business.gstNumber},...totals,taxMode:input.taxMode,taxRateBps:input.taxRateBps,paidPaise:input.paidPaise,paymentMode:input.paymentMode,note:input.note}});
      for(let index=0;index<input.items.length;index++){
        const item=input.items[index];const variant=variants.find(v=>v.id===item.variantId)!;
        const result=await tx.variant.updateMany({where:{id:variant.id,businessId:business.id,stock:{gte:item.quantity}},data:{stock:{decrement:item.quantity}}});if(!result.count)throw new BadRequestException(`Insufficient stock: ${variant.product.name} (${variant.size} / ${variant.color}). Available: ${variant.stock}`);
        const after=(await tx.variant.findUniqueOrThrow({where:{id:variant.id}})).stock;
        await tx.invoiceItem.create({data:{invoiceId:invoice.id,productId:variant.productId,variantId:variant.id,productName:variant.product.name,sku:variant.product.sku,size:variant.size,color:variant.color,quantity:item.quantity,unitPricePaise:item.unitPricePaise,lineTotalPaise:lineTotals[index]}});
        await tx.stockMovement.create({data:{businessId:business.id,productId:variant.productId,variantId:variant.id,actorId:actor.id,type:"BILLING",quantity:-item.quantity,balanceAfter:after,note:`Invoice ${number}`,reference:invoice.id}});
        await tx.product.update({where:{id:variant.productId},data:{soldUnits:{increment:item.quantity}}});
        if(after<=variant.lowStockAt&&variant.stock>variant.lowStockAt)await notify(tx,business.id,null,"Low stock",`${variant.product.name} · ${variant.size}/${variant.color}: ${after} units left`,"/dashboard/inventory");
      }
      if(input.paidPaise>0)await tx.payment.create({data:{businessId:business.id,invoiceId:invoice.id,actorId:actor.id,requestKey:input.requestKey,amountPaise:input.paidPaise,mode:input.paymentMode,note:"Payment received at billing"}});
      if(input.inquiryId)await tx.inquiry.update({where:{id:input.inquiryId},data:{invoiceId:invoice.id,status:"WON"}});
      await audit(tx,actor.id,business.id,"INVOICE_ISSUED",invoice.id,`${number} · ${input.buyerName} · ${totals.totalPaise} paise`);
      return invoiceOutput(await tx.invoice.findUniqueOrThrow({where:{id:invoice.id},include:invoiceInclude}));
    });
  }
  async pay(actor:SessionUser,id:string,body:unknown){const input=parse(paymentSchema,body);return this.db.serial(async tx=>{
    const already=await tx.payment.findUnique({where:{businessId_requestKey:{businessId:actor.businessId!,requestKey:input.requestKey}}});if(already){if(already.invoiceId!==id||already.amountPaise!==input.amountPaise||already.mode!==input.mode||already.note!==input.note)throw new BadRequestException("Payment request key already used");return already;}
    const invoice=await tx.invoice.findFirst({where:{id,businessId:actor.businessId!,status:"ISSUED"}});if(!invoice)throw new NotFoundException("Active invoice not found");const due=invoice.totalPaise-invoice.returnedPaise-invoice.paidPaise;if(input.amountPaise>due)throw new BadRequestException("Payment exceeds the outstanding amount");
    await tx.invoice.update({where:{id},data:{paidPaise:{increment:input.amountPaise}}});const payment=await tx.payment.create({data:{...input,businessId:actor.businessId!,invoiceId:id,actorId:actor.id}});await audit(tx,actor.id,actor.businessId,"PAYMENT_RECORDED",id,`${input.amountPaise} paise · ${input.mode}`);return payment;
  });}
  async returnItems(actor:SessionUser,id:string,body:unknown){const input=parse(returnSchema,body);return this.db.serial(async tx=>{
    const already=await tx.invoiceReturn.findUnique({where:{businessId_requestKey:{businessId:actor.businessId!,requestKey:input.requestKey}},include:{items:true}});if(already){const existing=already.items.map(i=>`${i.invoiceItemId}:${i.quantity}`).sort().join(",");const submitted=input.items.map(i=>`${i.itemId}:${i.quantity}`).sort().join(",");if(already.invoiceId!==id||already.reason!==input.reason||existing!==submitted)throw new BadRequestException("Return request key already used");return already;}
    const invoice=await tx.invoice.findFirst({where:{id,businessId:actor.businessId!,status:"ISSUED"},include:{items:true}});if(!invoice)throw new NotFoundException("Active invoice not found");
    const lines=input.items.map(line=>{const item=invoice.items.find(i=>i.id===line.itemId);if(!item||line.quantity>item.quantity-item.returnedQuantity)throw new BadRequestException("Return quantity exceeds units sold");return {item,quantity:line.quantity,amount:returnValue(item.lineTotalPaise,item.quantity,item.returnedQuantity,line.quantity)};});
    const amountPaise=lines.reduce((s,l)=>s+l.amount,0);const record=await tx.invoiceReturn.create({data:{businessId:actor.businessId!,invoiceId:id,actorId:actor.id,requestKey:input.requestKey,reason:input.reason,amountPaise}});
    for(const line of lines){await tx.invoiceItem.update({where:{id:line.item.id},data:{returnedQuantity:{increment:line.quantity}}});const variant=await tx.variant.update({where:{id:line.item.variantId},data:{stock:{increment:line.quantity}}});await tx.product.update({where:{id:line.item.productId},data:{soldUnits:{decrement:line.quantity}}});await tx.returnItem.create({data:{returnId:record.id,invoiceItemId:line.item.id,quantity:line.quantity,amountPaise:line.amount}});await tx.stockMovement.create({data:{businessId:actor.businessId!,actorId:actor.id,productId:line.item.productId,variantId:line.item.variantId,type:"RETURN",quantity:line.quantity,balanceAfter:variant.stock,note:input.reason,reference:record.id}});}
    await tx.invoice.update({where:{id},data:{returnedPaise:{increment:amountPaise}}});await audit(tx,actor.id,actor.businessId,"INVOICE_RETURN",record.id,`${invoice.number} · ${input.reason}`);return record;
  });}
  async cancel(actor:SessionUser,id:string,body:unknown){const input=parse(z.object({reason:z.string().trim().min(3).max(500)}),body);return this.db.serial(async tx=>{
    const invoice=await tx.invoice.findFirst({where:{id,businessId:actor.businessId!},include:{items:true}});if(!invoice)throw new NotFoundException("Invoice not found");if(invoice.status==="CANCELLED")return {ok:true};
    for(const item of invoice.items){const quantity=item.quantity-item.returnedQuantity;if(!quantity)continue;const variant=await tx.variant.update({where:{id:item.variantId},data:{stock:{increment:quantity}}});await tx.product.update({where:{id:item.productId},data:{soldUnits:{decrement:quantity}}});await tx.stockMovement.create({data:{businessId:actor.businessId!,productId:item.productId,variantId:item.variantId,actorId:actor.id,type:"CANCELLATION",quantity,balanceAfter:variant.stock,note:input.reason,reference:id}});}
    await tx.invoice.update({where:{id},data:{status:"CANCELLED",cancellationReason:input.reason}});await audit(tx,actor.id,actor.businessId,"INVOICE_CANCELLED",id,`${invoice.number} · ${input.reason}`);return {ok:true};
  });}
}
@Controller("v1/billing") @UseGuards(SessionGuard)
export class BillingController {
  constructor(@Inject(BillingService) private readonly billing:BillingService){}
  @Get("variants") @Ability("BILLING","VIEW") variants(@Req()req:AuthRequest,@Query("q")q?:string){return this.billing.variants(req.actor,q?.slice(0,100));}
  @Get("invoices") @Ability("BILLING","VIEW") list(@Req()req:AuthRequest,@Query("q")q?:string){return this.billing.list(req.actor,q?.slice(0,100));}
  @Get("invoices/:id") @Ability("BILLING","VIEW") one(@Req()req:AuthRequest,@Param("id")id:string){return this.billing.one(req.actor,id);}
  @Post("invoices") @Ability("BILLING","CREATE") create(@Req()req:AuthRequest,@Body()body:unknown){return this.billing.create(req.actor,body);}
  @Post("invoices/:id/payments") @Ability("BILLING","EDIT") pay(@Req()req:AuthRequest,@Param("id")id:string,@Body()body:unknown){return this.billing.pay(req.actor,id,body);}
  @Post("invoices/:id/returns") @Ability("BILLING","EDIT") returns(@Req()req:AuthRequest,@Param("id")id:string,@Body()body:unknown){return this.billing.returnItems(req.actor,id,body);}
  @Post("invoices/:id/cancel") @Ability("BILLING","DELETE") cancel(@Req()req:AuthRequest,@Param("id")id:string,@Body()body:unknown){return this.billing.cancel(req.actor,id,body);}
  @Get("export") @Ability("BILLING","VIEW") async export(@Req()req:AuthRequest,@Res()res:Response){const {invoices}=await this.billing.list(req.actor);res.setHeader("Content-Type","text/csv; charset=utf-8");res.setHeader("Content-Disposition",'attachment; filename="invoices.csv"');res.send(csv([["Invoice","Date","Buyer","Mobile","Total INR","Returns INR","Received INR","Due INR","Status"],...invoices.map(i=>[i.number,i.createdAt.toISOString(),i.buyerName,i.buyerPhone,i.totalPaise/100,i.returnedPaise/100,i.paidPaise/100,i.duePaise/100,i.paymentStatus])]));}
}
@Module({imports:[AuthModule],providers:[BillingService],controllers:[BillingController],exports:[BillingService]})
export class BillingModule {}
