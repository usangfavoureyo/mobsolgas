import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { PwaRegister } from "@/components/pwa-register";

export const metadata: Metadata = {
  title: "Mobsol Gas | Abuja",
  description: "Order and track Mobsol Gas cylinder exchanges in Abuja.",
  applicationName: "Mobsol Gas",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/mobsol-monogram.png", apple: "/icons/mobsol-monogram.png" },
  appleWebApp: { capable: true, title: "Mobsol Gas", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#EC5E12",
  colorScheme: "light dark",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>
          <PwaRegister />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
