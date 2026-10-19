import type { Metadata } from "next";
import localFont from 'next/font/local';
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const geistSans = localFont({
  src: '../public/workout/fonts/geist.woff2',
  variable: "--font-geist-sans",
  display: 'swap',
});

const geistMono = localFont({
  src: '../public/workout/fonts/jetbrains-mono.woff2',
  variable: "--font-geist-mono",
  display: 'swap',
});

export const metadata: Metadata = {
  title: "Whooper — Your recovery. A clearer tomorrow.",
  description:
    "Your WHOOP dashboard, workout journal and share studio. Bring your recovery, sleep and training context to your AI coach.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col">{children}</body>
      </html>
    </ClerkProvider>
  );
}
