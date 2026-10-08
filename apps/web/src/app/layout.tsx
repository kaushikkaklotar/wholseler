import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Providers } from "@/components/session";
export const metadata = {
  title: { default: "BulkSaathi · Your wholesale business partner", template: "%s · BulkSaathi" },
  applicationName: "BulkSaathi",
  description: "Discover wholesale suppliers and products. Manage your business catalog, inventory, billing and team with BulkSaathi.",
  icons: { icon: "/favicon.ico", apple: "/apple-touch-icon.png" },
  manifest: "/manifest.webmanifest",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className={GeistSans.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
