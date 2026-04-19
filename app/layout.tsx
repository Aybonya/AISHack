import type { Metadata } from "next";
import { Audiowide, Manrope, Space_Grotesk } from "next/font/google";

import { AppShell } from "@/components/app-shell";
import { AppProvider } from "@/components/providers/app-provider";

import "@/app/globals.css";

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-manrope",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

const audiowide = Audiowide({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-audiowide",
});

export const metadata: Metadata = {
  title: "AISana",
  description: "AI-powered school operations dashboard for Aqbobek School",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      className={`${manrope.variable} ${spaceGrotesk.variable} ${audiowide.variable}`}
      lang="ru"
    >
      <body className="font-sans antialiased">
        <AppProvider>
          <AppShell>{children}</AppShell>
        </AppProvider>
      </body>
    </html>
  );
}
