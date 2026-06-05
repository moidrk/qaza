import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Qaza - Your Prayer Buddy",
  description: "A gentle way to track and complete your daily and missed prayers.",
  manifest: "/manifest.json",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
};

import { Providers } from "@/components/providers";
import { BottomNav } from "@/components/BottomNav";
import { Toaster } from "sonner";
import { PullToRefresh } from "@/components/PullToRefresh";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} antialiased`}
      suppressHydrationWarning
    >
      <body className="h-[100dvh] flex flex-col font-sans overflow-hidden overscroll-none bg-background">
        <Providers>
          <PullToRefresh>
            {children}
          </PullToRefresh>
          <BottomNav />
          <Toaster 
            position="top-center" 
            toastOptions={{
              classNames: {
                toast: "group flex items-center gap-3 border border-border shadow-lg font-sans rounded-full px-5 py-4 w-auto",
                success: "bg-card text-primary border-primary/30",
                error: "bg-card text-destructive border-destructive/30",
                info: "bg-card text-foreground border-border",
                warning: "bg-card text-chart-3 border-chart-3/30",
              }
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
