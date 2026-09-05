"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ArrowLeft, Check, ChevronsUpDown, Loader2, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
    getAllClients,
    getAllCommunities,
    createCommunity,
    updateCommunity,
    deleteCommunity,
    updateClient,
} from '@/lib/commercial-api';
import { coincideBusquedaCliente } from '@/lib/crm-filtros';
import type { CommercialClient } from '@/types/commercial';
import type { Community } from '@/types/communities';

// La cartera son miles de fichas: el combobox del líder pinta solo las primeras
// coincidencias, igual que el selector de destinatarios de Difusión.
const MAX_SUGERENCIAS_LIDER = 50;

export default function ComunidadesPage() {
    const { toast } = useToast();
    const [communities, setCommunities] = useState<Community[]>([]);
    const [clients, setClients] = useState<CommercialClient[]>([]);
    const [loading, setLoading] = useState(true);

    // Diálogo de alta/edición. `editando` en null significa "nueva comunidad".
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editando, setEditando] = useState<Community | null>(null);
    const [nombre, setNombre] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [liderId, setLiderId] = useState('');
    const [liderPopoverOpen, setLiderPopoverOpen] = useState(false);
    const [busquedaLider, setBusquedaLider] = useState('');
    const [guardando, setGuardando] = useState(false);

    const cargar = async () => {
        const [coms, cls] = await Promise.all([getAllCommunities(), getAllClients()]);
        setCommunities(coms);
        setClients(cls);
        setLoading(false);
    };

    useEffect(() => {
        cargar();
    }, []);

    // Se cuenta sobre las fichas y no sobre el `memberCount` heredado del módulo antiguo:
    // ningún flujo del CRM lo mantiene al día, así que mentiría en cuanto alguien mueva
    // un contacto de comunidad.
    const miembrosPorComunidad = useMemo(() => {
        const conteo = new Map<string, number>();
        for (const c of clients) {
            if (c.community_id) conteo.set(c.community_id, (conteo.get(c.community_id) || 0) + 1);
        }
        return conteo;
    }, [clients]);

    const lider = clients.find(c => c.id === liderId);

    const clientesSugeridos = useMemo(
        () => clients.filter(c => coincideBusquedaCliente(c, busquedaLider)).slice(0, MAX_SUGERENCIAS_LIDER),
        [clients, busquedaLider]
    );

    const abrirNueva = () => {
        setEditando(null);
        setNombre('');
        setDescripcion('');
        setLiderId('');
        setBusquedaLider('');
        setIsFormOpen(true);
    };

    const abrirEdicion = (com: Community) => {
        setEditando(com);
        setNombre(com.name || '');
        setDescripcion(com.description || '');
        setLiderId(com.leader_client_id || '');
        setBusquedaLider('');
        setIsFormOpen(true);
    };

    const guardar = async () => {
        const name = nombre.trim();
        if (!name) {
            toast({ title: 'El nombre de la comunidad es obligatorio', variant: 'destructive' });
            return;
        }
        setGuardando(true);
        try {
            const datos = {
                name,
                description: descripcion.trim(),
                leader_client_id: liderId,
                leader_client_name: lider?.name || '',
            };
            const communityId = editando?.id
                ? (await updateCommunity(editando.id, datos), editando.id)
                : await createCommunity(datos);

            // El nombre está denormalizado en cada ficha (es lo que se pinta en la tarjeta
            // y lo que alimenta el filtro del tablero), así que un renombrado tiene que
            // bajar a los miembros o la comunidad aparecería partida en dos nombres.
            if (editando && editando.name !== name) {
                const miembros = clients.filter(c => c.community_id === communityId && c.id);
                await Promise.all(
                    miembros.map(c => updateClient(c.id!, { community_name: name }))
                );
            }

            // El líder pasa a pertenecer a su propia comunidad: si no, quedaría fuera del
            // filtro y del conteo de la comunidad que encabeza.
            if (liderId && lider?.community_id !== communityId) {
                await updateClient(liderId, { community_id: communityId, community_name: name });
            }

            setIsFormOpen(false);
            await cargar();
            toast({ title: editando ? 'Comunidad actualizada' : 'Comunidad creada' });
        } catch (error) {
            console.error('Error al guardar la comunidad:', error);
            toast({ title: 'No se pudo guardar la comunidad', variant: 'destructive' });
        } finally {
            setGuardando(false);
        }
    };

    const borrar = async (com: Community) => {
        const miembros = miembrosPorComunidad.get(com.id) || 0;
        if (miembros > 0) {
            toast({
                title: 'No se puede eliminar',
                description: `«${com.name}» todavía tiene ${miembros} contacto(s). Muévelos a otra comunidad primero.`,
                variant: 'destructive',
            });
            return;
        }
        if (!confirm(`¿Eliminar la comunidad «${com.name}»?`)) return;
        try {
            await deleteCommunity(com.id);
            await cargar();
            toast({ title: 'Comunidad eliminada' });
        } catch (error) {
            console.error('Error al eliminar la comunidad:', error);
            toast({ title: 'No se pudo eliminar la comunidad', variant: 'destructive' });
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-200px)]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/commercial/crm/dashboard"><ArrowLeft className="h-4 w-4" /></Link>
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold">Comunidades</h1>
                        <p className="text-sm text-muted-foreground">
                            Grupos a los que pertenecen los contactos del CRM, y quién los lidera.
                        </p>
                    </div>
                </div>
                <Button onClick={abrirNueva}>
                    <Plus className="mr-2 h-4 w-4" /> Nueva comunidad
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" /> {communities.length} comunidad(es)
                    </CardTitle>
                    <CardDescription>
                        Los miembros se cuentan sobre las fichas del CRM asignadas a cada comunidad.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {communities.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-6 text-center">
                            Todavía no hay comunidades. Crea la primera para poder asignarla a los contactos.
                        </p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nombre</TableHead>
                                    <TableHead>Líder</TableHead>
                                    <TableHead className="text-right">Miembros</TableHead>
                                    <TableHead className="w-[100px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {communities.map(com => (
                                    <TableRow key={com.id}>
                                        <TableCell>
                                            <div className="font-medium">{com.name}</div>
                                            {com.description && (
                                                <div className="text-xs text-muted-foreground">{com.description}</div>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {com.leader_client_id ? (
                                                <Link
                                                    href={`/commercial/crm/client/${com.leader_client_id}`}
                                                    className="text-primary hover:underline"
                                                >
                                                    {com.leader_client_name || 'Ver ficha'}
                                                </Link>
                                            ) : (
                                                <span className="text-muted-foreground">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {miembrosPorComunidad.get(com.id) || 0}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex justify-end gap-1">
                                                <Button variant="ghost" size="icon" onClick={() => abrirEdicion(com)}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => borrar(com)}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editando ? 'Editar comunidad' : 'Nueva comunidad'}</DialogTitle>
                        <DialogDescription>
                            El líder es un contacto del CRM y queda asignado a esta comunidad.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="nombre">Nombre</Label>
                            <Input id="nombre" value={nombre} onChange={e => setNombre(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="descripcion">Descripción</Label>
                            <Textarea
                                id="descripcion"
                                rows={2}
                                value={descripcion}
                                onChange={e => setDescripcion(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Líder</Label>
                            <Popover open={liderPopoverOpen} onOpenChange={setLiderPopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                                        {lider?.name || 'Seleccionar contacto...'}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[340px] p-0" align="start">
                                    {/* shouldFilter={false}: el filtrado lo hace
                                        coincideBusquedaCliente, que también busca por teléfono. */}
                                    <Command shouldFilter={false}>
                                        <CommandInput
                                            placeholder="Buscar por nombre, correo o teléfono..."
                                            value={busquedaLider}
                                            onValueChange={setBusquedaLider}
                                        />
                                        <CommandList>
                                            {clientesSugeridos.length === 0 ? (
                                                <CommandEmpty>Ningún contacto coincide</CommandEmpty>
                                            ) : (
                                                clientesSugeridos.map(c => (
                                                    <CommandItem
                                                        key={c.id}
                                                        value={c.id}
                                                        onSelect={() => {
                                                            setLiderId(c.id!);
                                                            setLiderPopoverOpen(false);
                                                        }}
                                                    >
                                                        <Check
                                                            className={`mr-2 h-4 w-4 ${liderId === c.id ? 'opacity-100' : 'opacity-0'}`}
                                                        />
                                                        <div className="flex flex-col">
                                                            <span>{c.name}</span>
                                                            <span className="text-xs text-muted-foreground">
                                                                {c.phone} · {c.email}
                                                            </span>
                                                        </div>
                                                    </CommandItem>
                                                ))
                                            )}
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                            {liderId && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs text-muted-foreground"
                                    onClick={() => setLiderId('')}
                                >
                                    Quitar líder
                                </Button>
                            )}
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={() => setIsFormOpen(false)}>Cancelar</Button>
                        <Button onClick={guardar} disabled={guardando}>
                            {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Guardar
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
