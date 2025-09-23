

"use client";

import { CancellationsContent } from "@/components/cancellations/page";
import { AuthProviderWrapper } from "@/components/auth-provider-wrapper";

export default function CancellationsPage() {
    return (
        <AuthProviderWrapper allowedRoles={['admin', 'commercial', 'logistics']}>
            <CancellationsContent />
        </AuthProviderWrapper>
    )
}
