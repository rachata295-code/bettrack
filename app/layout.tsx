import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BetTrack",
  description: "Track your own betting balance and results.",
};

// viewport-fit=cover lets env(safe-area-inset-bottom) report the notch inset so content clears the bottom nav.
export const viewport: Viewport = { viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // "dark" is hard-coded: the app ships a single dark theme.
    <html lang="en" className={`${inter.variable} dark h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
