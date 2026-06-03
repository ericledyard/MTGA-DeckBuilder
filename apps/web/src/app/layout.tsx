import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { NavBar } from "@/components/ui/NavBar";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: "MTGA Deck Builder",
  description: "Build and manage Magic: The Gathering Arena decks",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased dark`}>
      <body className="min-h-full flex flex-col bg-gray-950 text-gray-100">
        <NavBar />
        <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
