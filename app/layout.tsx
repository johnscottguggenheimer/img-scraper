import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Img Scraper",
  description: "Ladda ner bild-URL:er från DevTools som zip",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sv">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
