import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/hooks/use-auth';
import { WarehouseProvider } from '@/hooks/use-warehouse';
import { Suspense } from 'react';
import MainLayout from '@/components/main-layout';

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
      <body className="font-body antialiased h-full bg-background flex flex-col">
        <Suspense fallback={<div className="flex h-screen w-full items-center justify-center">Cargando aplicación...</div>}>
          <WarehouseProvider>
              <AuthProvider>
                  <MainLayout>
                    {children}
                  </MainLayout>
              </AuthProvider>
          </WarehouseProvider>
        </Suspense>
        <Toaster />
      </body>
    </html>
  );
}
