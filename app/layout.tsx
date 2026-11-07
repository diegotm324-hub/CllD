import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ContablePro - SaaS Contable Peruano de Alto Rendimiento",
  description: "Sistema contable y tributario para el mercado peruano (SUNAT, PCGE, SIRE, PLE)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body className="antialiased min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        {children}
      </body>
    </html>
  );
}
