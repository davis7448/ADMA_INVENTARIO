import { CancellationsContent } from "@/components/cancellations-content";
import { AuthProviderWrapper } from "@/components/auth-provider-wrapper";
import { Suspense } from "react";

export default function CancellationsPage() {
    return (
        <Suspense>
            <AuthProviderWrapper allowedRoles={['admin', 'commercial', 'logistics']}>
                <CancellationsContent />
            </AuthProviderWrapper>
        </Suspense>
    )
}
