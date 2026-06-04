import type { Metadata } from "next";
import { Raleway, Anton } from "next/font/google";
import "./globals.css";
import { NavBar } from "@/components/ui/NavBar";

const raleway = Raleway({ subsets: ["latin"], variable: "--font-raleway" });
const anton = Anton({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-anton",
});

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
    <html
      lang="en"
      className={`${raleway.variable} ${anton.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-gray-950 text-gray-100">
        <NavBar />
        <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
