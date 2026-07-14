import type { Metadata } from "next";
import Sidenav from "@/components/Sidenav";
import "./globals.css";

export const metadata: Metadata = {
  title: "SalesSense",
  description: "Sales intelligence for Square 9",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <Sidenav />
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
