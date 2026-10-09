import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AFTER ROUND ONE — 3D Multiplayer Party Game",
  description: "A 3D multiplayer party game of reaction, timing, and number prediction. Built with Next.js, React, Three.js, TypeScript.",
  keywords: ["AFTER ROUND ONE", "party game", "multiplayer", "Three.js", "Next.js"],
  authors: [{ name: "AFTER ROUND ONE" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "AFTER ROUND ONE",
    description: "A 3D multiplayer party game of reaction, timing, and number prediction.",
    siteName: "AFTER ROUND ONE",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AFTER ROUND ONE",
    description: "A 3D multiplayer party game of reaction, timing, and number prediction.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <div className="min-h-screen bg-[#07090d] text-white">{children}</div>
        <Toaster />
      </body>
    </html>
  );
}
