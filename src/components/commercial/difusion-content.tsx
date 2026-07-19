"use client";

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import {
    createPromotions, getPromotions, updatePromotionOutcome, getClientsWithProductHistory,
    PROMOTION_CHANNEL_LABELS, PROMOTION_TYPE_LABELS, PROMOTION_OUTCOME_LABELS,
    type ProductPromotion, type PromotionChannel, type PromotionOutcome, type PromotionType,
} from '@/app/actions/promotions';
import { checkClientExists, createClient, getAllClients } from '@/lib/commercial-api';
import type { CommercialClient } from '@/types/commercial';
import { ProductSearchPicker, type ProductPick } from '@/components/product-search-picker';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Megaphone, Sparkles } from 'lucide-react';

export function DifusionContent() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [promotions, setPromotions] = useState<ProductPromotion[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);

    const canSeeAll = !!user && ['admin', 'commercial_director', 'coordinacion', 'marketing'].includes(user.role);

    const load = async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            setPromotions(await getPromotions(canSeeAll ? {} : { commercialId: user.id }));
        } catch (error) {
            console.error(error);
            toast({ title: 'Error', description: 'No se pudieron cargar las difusiones.', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { load(); }, [user?.id]);

    const handleOutcomeChange = async (promo: ProductPromotion, outcome: PromotionOutcome) => {
        if (!promo.id) return;
        try {
            await updatePromotionOutcome(promo.id, outcome);
            setPromotions(prev => prev.map(p => p.id === promo.id ? { ...p, outcome } : p));
        } catch (error) {
            toast({ title: 'Error', description: 'No se pudo actualizar el resultado.', variant: 'destructive' });
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline tracking-tight">Difusión Comercial</h1>
                    <p className="text-muted-foreground">Registra a quién ofertaste cada producto y haz seguimiento del resultado.</p>
                </div>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button><Megaphone className="h-4 w-4 mr-2" />Registrar Difusión</Button>
                    </DialogTrigger>
                    <PromotionFormDialog onCreated={() => { setDialogOpen(false); load(); }} />
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{canSeeAll ? 'Difusiones del Equipo' : 'Mis Difusiones'}</CardTitle>
                    <CardDescription>{promotions.length} registros</CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                    {isLoading ? <Skeleton className="h-32 w-full" /> : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Producto</TableHead>
                                    <TableHead>Cliente</TableHead>
                                    <TableHead>Canal</TableHead>
                                    <TableHead>Tipo</TableHead>
                                    {canSeeAll && <TableHead>Comercial</TableHead>}
                                    <TableHead>Resultado</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {promotions.length > 0 ? promotions.map(promo => (
                                    <TableRow key={promo.id}>
                                        <TableCell className="whitespace-nowrap">{format(new Date(promo.date), 'dd MMM HH:mm', { locale: es })}</TableCell>
                                        <TableCell className="font-medium max-w-[200px] truncate">{promo.productName}</TableCell>
                                        <TableCell className="max-w-[160px] truncate">{promo.clientName}</TableCell>
                                        <TableCell><Badge variant="outline">{PROMOTION_CHANNEL_LABELS[promo.channel]}</Badge></TableCell>
                                        <TableCell><Badge variant={promo.promotionType === 'nuevo_producto' ? 'default' : 'secondary'}>{PROMOTION_TYPE_LABELS[promo.promotionType]}</Badge></TableCell>
                                        {canSeeAll && <TableCell>{promo.commercialName}</TableCell>}
                                        <TableCell>
                                            <Select value={promo.outcome || 'sin_respuesta'} onValueChange={(v) => handleOutcomeChange(promo, v as PromotionOutcome)}>
                                                <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    {Object.entries(PROMOTION_OUTCOME_LABELS).map(([value, label]) => (
                                                        <SelectItem key={value} value={value}>{label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={canSeeAll ? 7 : 6} className="h-24 text-center">Aún no hay difusiones registradas.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function PromotionFormDialog({ onCreated }: { onCreated: () => void }) {
    const { user } = useAuth();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const [product, setProduct] = useState<ProductPick | null>(null);
    const [channel, setChannel] = useState<PromotionChannel>('whatsapp');
    const [promotionType, setPromotionType] = useState<PromotionType>('nuevo_producto');
    const [notes, setNotes] = useState('');
    const [clients, setClients] = useState<CommercialClient[]>([]);
    const [clientSearch, setClientSearch] = useState('');
    const [selected, setSelected] = useState<Record<string, boolean>>({});
    const [historyClients, setHistoryClients] = useState<Array<{ id: string; name: string; status?: string; source: string }>>([]);
    // Crear cliente al vuelo cuando no existe en el CRM
    const [showNewClient, setShowNewClient] = useState(false);
    const [isCreatingClient, setIsCreatingClient] = useState(false);
    const [newClient, setNewClient] = useState({ name: '', email: '', phone: '', city: '' });

    useEffect(() => {
        if (!user) return;
        getAllClients(user.role, user.id).then(setClients).catch(() => setClients([]));
    }, [user?.id]);

    const handleProductPick = async (p: ProductPick) => {
        setProduct(p);
        try {
            const history = await getClientsWithProductHistory(p.id);
            setHistoryClients(history);
        } catch {
            setHistoryClients([]);
        }
    };

    const filteredClients = useMemo(() => {
        const term = clientSearch.trim().toLowerCase();
        if (!term) return clients.slice(0, 50);
        return clients.filter(c =>
            c.name?.toLowerCase().includes(term) || c.email?.toLowerCase().includes(term)
        ).slice(0, 50);
    }, [clients, clientSearch]);

    const selectedCount = Object.values(selected).filter(Boolean).length;

    const toggleClient = (id: string) => setSelected(prev => ({ ...prev, [id]: !prev[id] }));

    const handleCreateClient = async () => {
        if (!user) return;
        if (!newClient.name.trim() || !newClient.email.trim() || !newClient.phone.trim()) {
            toast({ title: 'Error', description: 'Nombre, correo y teléfono son obligatorios.', variant: 'destructive' });
            return;
        }
        setIsCreatingClient(true);
        try {
            const exists = await checkClientExists(newClient.email.trim(), newClient.phone.trim());
            if (exists?.exists) {
                const assigned = exists.client?.assigned_commercial_name;
                toast({ title: 'Ya existe', description: `Este cliente ya está registrado${assigned ? ` (asignado a ${assigned})` : ''}. Búscalo en la lista.`, variant: 'destructive' });
                return;
            }
            const id = await createClient({
                name: newClient.name.trim(),
                email: newClient.email.trim(),
                phone: newClient.phone.trim(),
                city: newClient.city.trim() || '—',
                category: 'laboratorio',
                type: 'mixto',
                avg_sales: 0,
                status: 'finding_winner',
                assigned_commercial_id: user.id,
                assigned_commercial_name: user.name,
                birthday: new Date(),
                created_at: new Date(),
            } as CommercialClient, { id: user.id, name: user.name });

            const created = { id, name: newClient.name.trim(), email: newClient.email.trim(), phone: newClient.phone.trim() } as CommercialClient;
            setClients(prev => [created, ...prev]);
            setSelected(prev => ({ ...prev, [id]: true }));
            setShowNewClient(false);
            setNewClient({ name: '', email: '', phone: '', city: '' });
            toast({ title: 'Cliente creado', description: `${created.name} quedó registrado en el CRM y seleccionado.` });
        } catch (error) {
            toast({ title: 'Error', description: error instanceof Error ? error.message : 'No se pudo crear el cliente.', variant: 'destructive' });
        } finally {
            setIsCreatingClient(false);
        }
    };

    const selectHistoryClients = () => {
        setSelected(prev => {
            const next = { ...prev };
            for (const h of historyClients) next[h.id] = true;
            return next;
        });
        setPromotionType('remarketing');
    };

    const handleSubmit = async () => {
        if (!user) return;
        if (!product) {
            toast({ title: 'Error', description: 'Busca y selecciona el producto que difundiste.', variant: 'destructive' });
            return;
        }
        const chosen = clients.filter(c => c.id && selected[c.id!]);
        const chosenHistory = historyClients.filter(h => selected[h.id] && !chosen.some(c => c.id === h.id));
        const allChosen = [
            ...chosen.map(c => ({ id: c.id!, name: c.name })),
            ...chosenHistory.map(h => ({ id: h.id, name: h.name })),
        ];
        if (allChosen.length === 0) {
            toast({ title: 'Error', description: 'Selecciona al menos un cliente al que le ofertaste.', variant: 'destructive' });
            return;
        }

        setIsSaving(true);
        try {
            const result = await createPromotions({
                product: { id: product.id, name: product.name, sku: product.sku, categoryId: product.categoryId },
                clients: allChosen,
                channel,
                promotionType,
                notes,
                commercial: { id: user.id, name: user.name },
            });
            toast({ title: '¡Difusión registrada!', description: `${result.created} cliente(s) registrados con su evento en el CRM.` });
            setProduct(null); setChannel('whatsapp'); setPromotionType('nuevo_producto');
            setNotes(''); setSelected({}); setClientSearch(''); setHistoryClients([]);
            onCreated();
        } catch (error) {
            toast({ title: 'Error', description: error instanceof Error ? error.message : 'No se pudo registrar.', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
                <DialogTitle>Registrar Difusión</DialogTitle>
                <DialogDescription>La difusión la haces por fuera (WhatsApp/IG); aquí queda el registro por cliente. Fecha y comercial automáticos.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
                <div>
                    <Label>Producto difundido *</Label>
                    <div className="mt-1"><ProductSearchPicker onSelect={handleProductPick} /></div>
                    {product && <p className="text-xs text-green-600 mt-1">✓ {product.name}</p>}
                </div>

                {historyClients.length > 0 && (
                    <div className="border rounded-lg p-3 bg-muted/30">
                        <div className="flex items-center justify-between gap-2">
                            <p className="text-sm flex items-center gap-1.5">
                                <Sparkles className="h-4 w-4 text-primary" />
                                <strong>{historyClients.length}</strong> cliente(s) ya testearon o venden este producto
                            </p>
                            <Button type="button" variant="outline" size="sm" onClick={selectHistoryClients}>Seleccionarlos (remarketing)</Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                            {historyClients.slice(0, 5).map(h => h.name).join(', ')}{historyClients.length > 5 ? '…' : ''}
                        </p>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <Label>Canal *</Label>
                        <Select value={channel} onValueChange={(v) => setChannel(v as PromotionChannel)}>
                            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {Object.entries(PROMOTION_CHANNEL_LABELS).map(([value, label]) => (
                                    <SelectItem key={value} value={value}>{label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label>Tipo *</Label>
                        <Select value={promotionType} onValueChange={(v) => setPromotionType(v as PromotionType)}>
                            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {Object.entries(PROMOTION_TYPE_LABELS).map(([value, label]) => (
                                    <SelectItem key={value} value={value}>{label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div>
                    <div className="flex items-center justify-between">
                        <Label>Clientes a los que ofertaste * <span className="text-muted-foreground font-normal">({selectedCount} seleccionados)</span></Label>
                        <Button type="button" variant="outline" size="sm" onClick={() => setShowNewClient(!showNewClient)}>
                            {showNewClient ? 'Cancelar' : '+ Nuevo cliente'}
                        </Button>
                    </div>
                    {showNewClient && (
                        <div className="border rounded-lg p-3 mt-2 mb-2 space-y-2 bg-muted/30">
                            <p className="text-sm font-medium">Cliente nuevo (queda registrado en el CRM, asignado a ti)</p>
                            <div className="grid grid-cols-2 gap-2">
                                <Input placeholder="Nombre *" value={newClient.name} onChange={e => setNewClient(p => ({ ...p, name: e.target.value }))} className="h-9" />
                                <Input placeholder="Correo *" type="email" value={newClient.email} onChange={e => setNewClient(p => ({ ...p, email: e.target.value }))} className="h-9" />
                                <Input placeholder="Teléfono *" value={newClient.phone} onChange={e => setNewClient(p => ({ ...p, phone: e.target.value }))} className="h-9" />
                                <Input placeholder="Ciudad" value={newClient.city} onChange={e => setNewClient(p => ({ ...p, city: e.target.value }))} className="h-9" />
                            </div>
                            <Button type="button" size="sm" onClick={handleCreateClient} disabled={isCreatingClient}>
                                {isCreatingClient ? 'Creando…' : 'Crear y seleccionar'}
                            </Button>
                        </div>
                    )}
                    <Input value={clientSearch} onChange={e => setClientSearch(e.target.value)} placeholder="Buscar cliente por nombre o correo…" className="mt-1 mb-2" />
                    <div className="border rounded-md max-h-48 overflow-y-auto divide-y">
                        {filteredClients.map(client => (
                            <label key={client.id} className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-muted/40">
                                <Checkbox checked={!!selected[client.id!]} onCheckedChange={() => toggleClient(client.id!)} />
                                <span className="text-sm flex-1 truncate">{client.name}</span>
                                <span className="text-xs text-muted-foreground truncate max-w-[160px]">{client.email}</span>
                            </label>
                        ))}
                        {filteredClients.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-4">Sin clientes que coincidan.</p>
                        )}
                    </div>
                </div>

                <div>
                    <Label htmlFor="promo-notes">Notas</Label>
                    <Textarea id="promo-notes" value={notes} onChange={e => setNotes(e.target.value)} className="mt-1 resize-none h-16" placeholder="Opcional: detalle de la oferta" />
                </div>
            </div>
            <DialogFooter>
                <DialogClose asChild><Button variant="secondary">Cancelar</Button></DialogClose>
                <Button onClick={handleSubmit} disabled={isSaving}>{isSaving ? 'Registrando…' : `Registrar (${selectedCount})`}</Button>
            </DialogFooter>
        </DialogContent>
    );
}
