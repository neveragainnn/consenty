import type { Metadata, Viewport } from "next";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { SITE } from "@/config/site";
import { body, display } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: `${SITE.brand} — аксессуары с вашим принтом`, template: `%s — ${SITE.brand}` },
  description: SITE.description,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#e4e4df",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-dvh antialiased">
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
