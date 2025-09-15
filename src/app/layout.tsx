import type { Metadata } from 'next';
import './globals.css';
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';
import { Toaster } from '@/components/ui/toaster';
import AppHeader from '@/components/header';
import AppSidebar from '@/components/sidebar';
import { AuthProvider } from '@/hooks/use-auth';

export const metadata: Metadata = {
  title: 'Dropstream',
  description: 'A dropshipping management platform.',
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
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased h-full">
        <AuthProvider>
          <SidebarProvider>
            <AppSidebar />
            <div className="flex flex-col flex-1">
              <AppHeader />
              <SidebarInset>
                <main className="flex-1 p-4 md:p-6 lg:p-8">
                  {children}
                </main>
              </SidebarInset>
            </div>
          </SidebarProvider>
        </AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
