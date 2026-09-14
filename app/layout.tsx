import type { Metadata } from "next";
import { Newsreader } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

// Geist isn't in this pinned Next.js version's next/font/google data yet, so it's
// loaded the same way Stitch's own reference markup loads it: a Google Fonts stylesheet.
const newsreader = Newsreader({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-newsreader" });

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
    <html lang="en" suppressHydrationWarning className={newsreader.variable}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- App Router root layout, not pages/_document; this rule predates the App Router. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased font-sans bg-surface text-on-surface">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
