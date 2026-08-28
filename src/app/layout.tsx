import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Haryana Ration Dashboard",
  description:
    "Haryana PDS (ePOS) ka data ek saaf dashboard me + selected FPS ke liye daily email monitor.",
};

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/card", label: "Card Lookup" },
  { href: "/admin", label: "Monitor" },
] as const;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <header className="border-b border-border bg-surface">
          <nav className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
            <span className="font-semibold tracking-tight">
              🌾 Ration Dashboard
            </span>
            <div className="flex gap-4 text-sm text-muted">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="transition-colors hover:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
          {children}
        </main>
        <footer className="border-t border-border px-4 py-3 text-center text-xs text-muted">
          Personal use · data source: epos.haryanafood.gov.in
        </footer>
      </body>
    </html>
  );
}
