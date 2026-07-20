import type { Metadata } from "next";
import Sidenav from "@/components/Sidenav";
import { currentAppUser } from "@/lib/authz";
import "./globals.css";

export const metadata: Metadata = {
  title: "SalesSense",
  description: "Sales intelligence platform",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentAppUser().catch(() => null);
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <Sidenav role={user?.role ?? null} />
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
