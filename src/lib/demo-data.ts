import { cashierPermissions, catalogPermissions } from "@/lib/permissions";

export const sampleMetrics = [
  { label: "Active products", value: "1,284", trend: "+142 this week" },
  { label: "Live stock value", value: "Rs. 42.8L", trend: "+8.4% this month" },
  { label: "Seller inquiries", value: "328", trend: "+51 today" },
  { label: "Bills generated", value: "94", trend: "Rs. 3.2L today" }
];

export const staffMembers = [
  {
    name: "Rahul Patel",
    phone: "+91 98765 43210",
    designation: "Counter billing",
    status: "Active",
    lastActive: "Today, 11:20 AM",
    permissions: cashierPermissions
  },
  {
    name: "Mehul Shah",
    phone: "+91 98765 11122",
    designation: "Catalog operator",
    status: "Active",
    lastActive: "Today, 10:05 AM",
    permissions: catalogPermissions
  },
  {
    name: "Jignesh Vekariya",
    phone: "+91 98765 77889",
    designation: "Packing support",
    status: "Invited",
    lastActive: "Invitation sent",
    permissions: cashierPermissions
  }
];

export const products = [
  {
    sku: "TSH-2401",
    name: "Cotton round neck t-shirt",
    category: "Menswear",
    stock: 420,
    price: "Rs. 185",
    visibility: "Public"
  },
  {
    sku: "KUR-1189",
    name: "Printed rayon kurti",
    category: "Womenswear",
    stock: 186,
    price: "Rs. 310",
    visibility: "Approved sellers"
  },
  {
    sku: "DRS-7710",
    name: "One-piece western dress",
    category: "Womenswear",
    stock: 72,
    price: "Rs. 520",
    visibility: "Public"
  },
  {
    sku: "FTW-5532",
    name: "Casual foam slippers",
    category: "Footwear",
    stock: 38,
    price: "Rs. 145",
    visibility: "Public"
  }
];

export const invoices = [
  { number: "INV-1029", buyer: "Jay Ecommerce", amount: "Rs. 18,400", status: "Paid", staff: "Rahul" },
  { number: "INV-1030", buyer: "Shree Retail", amount: "Rs. 7,850", status: "Issued", staff: "Rahul" },
  { number: "INV-1031", buyer: "Online Hub", amount: "Rs. 24,100", status: "Partial", staff: "Mehul" }
];

export const inquiries = [
  { seller: "Aarav Online Store", product: "Cotton round neck t-shirt", quantity: "200 pcs", source: "WhatsApp" },
  { seller: "Surat Reseller Hub", product: "Printed rayon kurti", quantity: "Mixed carton", source: "Call" },
  { seller: "StyleCart", product: "Casual foam slippers", quantity: "100 pairs", source: "WhatsApp" }
];
