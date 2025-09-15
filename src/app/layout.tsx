import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import AppHeader from '@/components/header';
import { AuthProvider } from '@/hooks/use-auth';

export const metadata: Metadata = {
  title: 'ADMA',
  description: 'Productos para Dropshipping como traídos de la luna.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@300;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased h-full bg-background">
        <AuthProvider>
            <div className="flex flex-col flex-1 h-full">
              <AppHeader />
                <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
                  {children}
                </main>
            </div>
        </AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
