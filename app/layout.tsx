import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";
import { cn } from "@/lib/utils";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import { Toaster } from "@/components/ui/sonner";
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from "@/lib/site";
import { GoogleAnalytics } from "@/components/analytics/google-analytics";
import { AnalyticsPageview } from "@/components/analytics/analytics-pageview";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: `${SITE_NAME} — Meeting Intelligence`,
  description: SITE_DESCRIPTION,
  icons: {
    icon: "/logo-icon.svg",
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Meeting Intelligence`,
    description: SITE_DESCRIPTION,
    images: ["/logo-og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — Meeting Intelligence`,
    description: SITE_DESCRIPTION,
    images: ["/logo-og.png"],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className={cn("dark font-sans", inter.variable)}>
      <body className="antialiased bg-background text-foreground">
        <GoogleAnalytics />
        <Suspense fallback={null}>
          <AnalyticsPageview />
        </Suspense>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <AuthSessionProvider>{children}</AuthSessionProvider>
          <Toaster richColors position="top-right" theme="dark" />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
