import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navigation } from "@/components/Navigation";
import { AIAssistantButton } from "@/components/AIAssistantButton";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CourtEdge | AI Tennis Platform",
  description: "AI-powered tennis coaching and player development platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-slate-950 text-slate-100 min-h-screen`}>
        <Navigation />
        <main className="md:ml-64 pb-20 md:pb-0 min-h-screen">
          {children}
        </main>
        <AIAssistantButton />
      </body>
    </html>
  );
}
