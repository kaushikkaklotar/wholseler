import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wholesale Commerce System",
  description: "B2B operating system for wholesalers and ecommerce sellers"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
