import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "9anouni / قانوني",
  description: "9anouni bilingual legal assistant for Tunisian legal professionals.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" dir="ltr">
      <body className="font-fr antialiased bg-[var(--bg-main)] text-[var(--text-dark)]">{children}</body>
    </html>
  );
}
