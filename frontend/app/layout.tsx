import type { Metadata } from 'next';
import { Geist, Cormorant_Garamond } from 'next/font/google';
import './globals.css';
import Background from '@/src/components/Background/Background';
import Navbar from '@/src/components/Navbar/Navbar';
import Footer from '@/src/components/Footer/Footer';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const cormorant = Cormorant_Garamond({
  variable: '--font-cormorant',
  subsets: ['latin'],
  weight: ['400', '600', '700'],
});

export const metadata: Metadata = {
  title: {
    template: 'Tipti Bootcamp | %s',
    default: 'Tipti Bootcamp | Space Gods',
  },
  description: 'Tipti Bootcamp for Set 17: Space Gods by eulb',
  icons: {
    icon: '/icon.png',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${cormorant.variable} antialiased flex flex-col min-h-screen`}>
        <Background />
        <Navbar />
        <main className="flex-grow">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
