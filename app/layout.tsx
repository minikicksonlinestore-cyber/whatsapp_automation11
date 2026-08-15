import type { Metadata } from 'next';
import './globals.css';
import Navigation from '@/components/Navigation';

export const metadata: Metadata = {
  title: 'AutoRemind WhatsApp — Automated PDF Calendar Reminders',
  description: 'Automated 1-day-prior WhatsApp reminders from PDF calendars using official Meta WhatsApp Cloud API.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased flex flex-col font-sans">
        <Navigation />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
        <footer className="border-t border-slate-200 bg-white/70 py-6 text-center text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-2">
            <div>
              AutoRemind • Official Meta WhatsApp Cloud API Integration (Business Number: +91 9061082040)
            </div>
            <div>
              Automated Reminders running via Vercel Cron & Supabase
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
