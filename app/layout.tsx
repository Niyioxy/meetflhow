import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "MeetFlhow — Meeting Intelligence",
  description:
    "Record, transcribe, and analyze your meetings with AI. Summaries, action items, decisions, and sentiment — automatically.",
  icons: {
    icon: "/logo-icon.svg",
  },
  openGraph: {
    title: "MeetFlhow — Meeting Intelligence",
    description:
      "Record, transcribe, and analyze your meetings with AI. Summaries, action items, decisions, and sentiment — automatically.",
    images: ["/logo-og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("dark font-sans", inter.variable)}>
      <body className="antialiased bg-background text-foreground">
        <AuthSessionProvider>{children}</AuthSessionProvider>
        <Toaster richColors position="top-right" theme="dark" />
      </body>
    </html>
  );
}
