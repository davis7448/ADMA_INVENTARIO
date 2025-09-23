

"use client";

import { CancellationsContent } from "@/components/cancellations/page";
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
