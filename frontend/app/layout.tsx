import type { Metadata } from 'next';
import { Geist, Cormorant_Garamond } from 'next/font/google';
import './globals.css';
import Background from '@/src/components/background/Background';
import Navbar from '@/src/components/navbar/Navbar';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const cormorant = Cormorant_Garamond({
  variable: '--font-cormorant',
  subsets: ['latin'],
  weight: ['400', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Space Gods | TFT Tournament',
  description: 'TFT competition leaderboard — Space Gods set',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${cormorant.variable} antialiased`}>
        <Background />
        <Navbar />
        {children}
      </body>
    </html>
  );
}
