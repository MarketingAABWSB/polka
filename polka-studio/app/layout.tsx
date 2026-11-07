import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "polka. — More smiles. Less serious.",
  description: "A little camera. A lot of joy. Your playful photobooth with live filters, custom polka-dot photo strips, and memories to download and keep.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
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
