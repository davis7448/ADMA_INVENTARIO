"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DEFAULT_CRM_CONFIG, daysSinceLastContact, getClientVolume, loadCrmConfig, type CrmConfig } from '@/lib/client-volume';
import type { CommercialClient } from '@/types/commercial';
import { AlertTriangle, BellRing } from 'lucide-react';

// Alertas de seguimiento: clientes sin contacto reciente (oferta, pedido o nota),
// priorizando los de mayor volumen. Umbrales configurables en Ajustes.
export function FollowUpAlerts({ clients }: { clients: CommercialClient[] }) {
    const [config, setConfig] = useState<CrmConfig>(DEFAULT_CRM_CONFIG);
    useEffect(() => { loadCrmConfig().then(setConfig); }, []);
    const WARN_DAYS = config.warnDays;
    const ALERT_DAYS = config.alertDays;

    const stale = clients
        .map(client => ({ client, days: daysSinceLastContact(client), volume: getClientVolume(client, config) }))
        .filter(x => x.days !== null && x.days >= WARN_DAYS)
        .sort((a, b) => {
            // Primero mayor volumen, luego más días sin contacto
            const tierRank = { A: 0, B: 1, C: 2, Nuevo: 3 } as const;
            const byTier = tierRank[a.volume.tier] - tierRank[b.volume.tier];
            return byTier !== 0 ? byTier : (b.days! - a.days!);
        });

    const critical = stale.filter(x => x.days! >= ALERT_DAYS);

    if (stale.length === 0) {
        return (
            <Card>
                <CardContent className="py-6 text-center text-sm text-muted-foreground">
                    ✓ Todos tus clientes han sido contactados en los últimos {WARN_DAYS} días.
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className={critical.length > 0 ? 'border-destructive/40' : ''}>
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                    <BellRing className="h-4 w-4" />
                    Clientes sin contacto reciente
                </CardTitle>
                <CardDescription>
                    {critical.length > 0 ? `${critical.length} con más de ${ALERT_DAYS} días · ` : ''}
                    {stale.length} con más de {WARN_DAYS} días. Priorizados por volumen.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1.5">
                {stale.slice(0, 12).map(({ client, days, volume }) => (
                    <Link
                        key={client.id}
                        href={`/commercial/crm/client/${client.id}`}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50"
                    >
                        <Badge variant={volume.tier === 'A' ? 'default' : 'secondary'} className="w-7 justify-center shrink-0">{volume.tier === 'Nuevo' ? '—' : volume.tier}</Badge>
                        <span className="text-sm flex-1 truncate">{client.name}</span>
                        <span className="text-xs text-muted-foreground truncate max-w-[140px] hidden sm:inline">{client.assigned_commercial_name}</span>
                        <span className={`text-xs font-medium whitespace-nowrap flex items-center gap-1 ${days! >= ALERT_DAYS ? 'text-destructive' : 'text-amber-600'}`}>
                            {days! >= ALERT_DAYS && <AlertTriangle className="h-3 w-3" />}{days} días
                        </span>
                    </Link>
                ))}
                {stale.length > 12 && (
                    <p className="text-xs text-muted-foreground text-center pt-1">…y {stale.length - 12} más.</p>
                )}
            </CardContent>
        </Card>
    );
}
