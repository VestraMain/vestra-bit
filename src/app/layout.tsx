import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vestra BIT — Bid Intelligence Tool",
  description: "Automate government RFP processing into bilingual PDF briefs",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
