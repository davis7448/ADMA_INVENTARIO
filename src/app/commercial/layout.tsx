import { CommercialSidebar } from "@/components/commercial/commercial-sidebar";

export default function CommercialLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-screen">
            <CommercialSidebar />
            <main className="flex-1 p-6 md:p-8 bg-background/50">
                {children}
            </main>
        </div>
    );
}
