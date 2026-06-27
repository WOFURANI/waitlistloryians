import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL('https://loryians.com'),
  alternates: {
    canonical: '/',
  },
  title: "Loryians — Minimalist Workspace for Solo Founders",
  description: "Loryians is the minimalist workspace for solo founders and small teams to plan, track, and ship projects faster without configuration fatigue or bloat.",
  keywords: ["project management", "kanban", "minimalist saas", "solo founder tools", "developer tools", "product management", "minimal board"],
  authors: [{ name: "Loryians Team" }],
  openGraph: {
    title: "Loryians — Minimalist Workspace for Solo Founders",
    description: "Loryians is the minimalist workspace for solo founders and small teams to plan, track, and ship projects faster without configuration fatigue or bloat.",
    url: "https://loryians.com",
    siteName: "Loryians",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Loryians — Minimalist Workspace for Solo Founders",
    description: "Loryians is the minimalist workspace for solo founders and small teams to plan, track, and ship projects faster without configuration fatigue or bloat.",
    creator: "@loryians",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white text-purple-950 font-sans selection:bg-purple-200 selection:text-purple-900">
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-H36E74DL2G"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());

            gtag('config', 'G-H36E74DL2G');
          `}
        </Script>
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              "name": "Loryians",
              "url": "https://loryians.com",
              "description": "The minimalist workspace for solo founders and small teams to plan, track, and ship projects faster.",
              "publisher": {
                "@type": "Organization",
                "name": "Loryians",
                "logo": "https://loryians.com/icon.svg"
              }
            })
          }}
        />
      </body>
    </html>
  );
}
