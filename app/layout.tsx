import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "colld — Sistema Contable Cloud Multi-Tenant y Bimoneda",
  description: "Plataforma contable y tributaria para el mercado peruano (SUNAT, PCGE, SIRE)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body className="antialiased min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
        {children}
      </body>
    </html>
  );
}
