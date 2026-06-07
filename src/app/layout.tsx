import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LogQ — Construction Labour Tracking",
  description: "Labour hours tracking for construction sites",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
