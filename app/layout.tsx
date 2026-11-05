import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { PwaRegister } from "@/components/layout/pwa-register";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BetTrack",
  description: "Track your own betting balance and results.",
  // Lets iOS "Add to Home Screen" launch full-screen with our name; the manifest covers Android.
  appleWebApp: { capable: true, title: "BetTrack", statusBarStyle: "black" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

// viewport-fit=cover lets env(safe-area-inset-bottom) report the notch inset so content clears the bottom nav.
// themeColor matches the dark background so the browser/status bar blends with the app.
export const viewport: Viewport = { viewportFit: "cover", themeColor: "#09090B" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // "dark" is hard-coded: the app ships a single dark theme.
    <html lang="en" className={`${inter.variable} dark h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <PwaRegister />
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
