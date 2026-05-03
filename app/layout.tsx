import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { NextSSRPlugin } from "@uploadthing/react/next-ssr-plugin";
import { extractRouterConfig } from "uploadthing/server";
import { SyncProvider } from "@/contexts/SyncContext";
import { SerwistProvider } from "@/components/providers/SerwistProvider";
import { ConvexClientProvider } from "@/components/providers/ConvexClientProvider";
import { ourFileRouter } from "@/app/api/uploadthing/core";
import "./globals.css";

const APP_NAME = "Smartcheck Inspecciones";
const APP_DEFAULT_TITLE = "Smartcheck PWA";
const APP_TITLE_TEMPLATE = "%s · Smartcheck";
const APP_DESCRIPTION = "Inspección vehicular pre-compra. Reportes Smartcheck.";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: {
    default: APP_DEFAULT_TITLE,
    template: APP_TITLE_TEMPLATE,
  },
  description: APP_DESCRIPTION,
  manifest: "/manifest.json",
  formatDetection: { telephone: false },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_DEFAULT_TITLE,
  },
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    title: APP_DEFAULT_TITLE,
    description: APP_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#1E3A5F",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ClerkProvider>
          <NextSSRPlugin
            routerConfig={extractRouterConfig(ourFileRouter)}
          />
          <ConvexClientProvider>
            <SyncProvider>
              <SerwistProvider
                swUrl="/serwist/sw.js"
                register
                cacheOnNavigation
                reloadOnOnline
              >
                {children}
              </SerwistProvider>
            </SyncProvider>
          </ConvexClientProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
