import type { Metadata } from "next";
import Link from "next/link";
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
          <nav className="sidenav">
            <div className="brand">
              Sales<span>Sense</span>
            </div>
            <Link href="/meetings">Meetings</Link>
            <div className="nav-disabled">
              Deals <small>SOON</small>
            </div>
            <div className="nav-disabled">
              Search <small>SOON</small>
            </div>
            <div className="nav-disabled">
              Analytics <small>SOON</small>
            </div>
            <div style={{ flex: 1 }} />
            <Link href="/test">Bot test page</Link>
          </nav>
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
