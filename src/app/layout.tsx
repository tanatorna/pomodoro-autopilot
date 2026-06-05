import type { Metadata } from "next";
import { Newsreader, IBM_Plex_Sans_Thai } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

// Ember theme: Newsreader (serif) สำหรับ heading + ตัวเลข timer
const newsreader = Newsreader({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
});

// IBM Plex Sans Thai สำหรับ body/UI/ไทย
const plexThai = IBM_Plex_Sans_Thai({
  variable: "--font-sans",
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Pomodachi",
  description: "Brain-dump → auto-schedule → auto-clock Pomodoro timer",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="th"
      className={`${plexThai.variable} ${newsreader.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
