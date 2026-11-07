import type { Metadata, Viewport } from "next";
import { Lexend, Source_Sans_3 } from "next/font/google";
import type { ReactNode } from "react";
import { Providers, themeScript } from "@/components/providers";
import { DevRoleSwitcher } from "@/components/dev/role-switcher";
import "./globals.css";

const lexend = Lexend({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-lexend",
  display: "swap",
});
const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-source-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "SIIP: from graduate to hired | SkillzBridge Trades Africa", template: "%s | SIIP" },
  description:
    "SIIP is a free programme that trains Nigerian graduates and NYSC members, then places them in three-month internships with verified companies.",
  openGraph: {
    type: "website",
    siteName: "SIIP by SkillzBridge Trades Africa",
    title: "From graduate to hired, in seven clear steps",
    description: "Free training, assessment and three-month internships with verified Nigerian companies.",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F7F6" },
    { media: "(prefers-color-scheme: dark)", color: "#141518" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-NG" className={`${lexend.variable} ${sourceSans.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <a
          href="#main"
          className="fixed top-3 left-3 z-[100] -translate-y-24 rounded-md bg-surface px-4 py-2 font-semibold shadow-lg focus:translate-y-0"
        >
          Skip to main content
        </a>
        <Providers>
          {children}
          {process.env.NODE_ENV !== "production" ? <DevRoleSwitcher /> : null}
        </Providers>
      </body>
    </html>
  );
}
