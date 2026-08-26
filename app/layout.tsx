import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FlowDo",
  description: "Find Your Flow.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
