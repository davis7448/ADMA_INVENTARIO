"use client";

import { useEffect, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getAllCommunities } from '@/lib/commercial-api';
import type { Community } from '@/types/communities';

// Radix no admite <SelectItem value="">, así que la opción "sin comunidad" viaja con un
// centinela, igual que el 'none' de updateUserWarehouseInDb en src/lib/api.ts.
const SIN_COMUNIDAD = 'none';

interface CommunitySelectProps {
    value?: string;
    // Devuelve id y nombre porque el nombre se guarda denormalizado en la ficha. "Sin
    // comunidad" viaja como cadena vacía y no como undefined: Firestore no está
    // configurado con ignoreUndefinedProperties y rechazaría el documento.
    onChange: (communityId: string, communityName: string) => void;
    id?: string;
}

// Selector del catálogo de comunidades. Carga la lista por su cuenta para que las
// pantallas que lo usan (alta de contacto y diálogo de edición) no repitan el fetch.
export function CommunitySelect({ value, onChange, id }: CommunitySelectProps) {
    const [communities, setCommunities] = useState<Community[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getAllCommunities()
            .then(setCommunities)
            .finally(() => setLoading(false));
    }, []);

    const handleChange = (val: string) => {
        if (val === SIN_COMUNIDAD) return onChange('', '');
        onChange(val, communities.find(c => c.id === val)?.name || '');
    };

    return (
        <Select value={value || SIN_COMUNIDAD} onValueChange={handleChange}>
            <SelectTrigger id={id}>
                <SelectValue placeholder={loading ? 'Cargando comunidades...' : 'Sin comunidad'} />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value={SIN_COMUNIDAD}>Sin comunidad</SelectItem>
                {communities.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
