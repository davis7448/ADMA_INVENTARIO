"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PAISES, etiquetaPais } from '@/lib/paises';
import { useAuth } from '@/hooks/use-auth';
import { createClient, checkClientExists, getUserById, addNoteToClient } from '@/lib/commercial-api';
import { getUsers } from '@/lib/api';
import { CommercialClient } from '@/types/commercial';
import type { User } from '@/lib/types';
import { ArrowLeft, Loader2, Plus, X, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

export default function RegisterClientPage() {
    const { user } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [submitting, setSubmitting] = useState(false);
    const [existingClient, setExistingClient] = useState<{
        exists: boolean;
        clientName?: string;
        assignedTo?: string;
        // Se muestran para que el comercial pueda juzgar si la coincidencia tiene
        // sentido, en vez de creerle a ciegas a la alerta.
        clientPhone?: string;
        clientEmail?: string;
        clientCountry?: string;
        matchedBy?: 'email' | 'phone';
        mismoPais?: 'igual' | 'distinto' | 'desconocido';
    } | null>(null);
    // Una coincidencia no siempre es un duplicado: dos tiendas pueden compartir un
    // contacto, y un mismo negocio puede operar en varios países con un comercial
    // distinto en cada uno. Cuando el comercial confirma que no es el mismo cliente,
    // se le deja continuar en vez de dejarlo bloqueado sin salida.
    const [ignorarCoincidencia, setIgnorarCoincidencia] = useState(false);

    // Lista de comerciales para admins
    const [commercials, setCommercials] = useState<User[]>([]);
    const [selectedCommercialId, setSelectedCommercialId] = useState<string>('');
    const [loadingCommercials, setLoadingCommercials] = useState(false);

    // Verificar si el usuario es admin
    const isAdmin = user?.role === 'admin' || user?.role === 'commercial_director';

    // Cargar lista de comerciales si es admin
    useEffect(() => {
        if (isAdmin) {
            setLoadingCommercials(true);
            getUsers().then(users => {
                const commercialUsers = users.filter(u => 
                    u.role === 'commercial' || u.role === 'commercial_director'
                );
                setCommercials(commercialUsers);
                setLoadingCommercials(false);
            }).catch(error => {
                console.error('Error loading commercials:', error);
                setLoadingCommercials(false);
            });
        }
    }, [isAdmin]);

    // Simple state for form
    const [formData, setFormData] = useState<Partial<CommercialClient>>({
        name: '',
        email: '',
        phone: '',
        city: '',
        // Sin valor por defecto: el país distingue una ficha de otra (un mismo cliente
        // puede operar en varios países, con un comercial distinto en cada uno), así que
        // dejarlo preseleccionado en COLOMBIA crearía fichas mal clasificadas.
        country: '',
        category: 'laboratorio',
        type: 'mixto',
        status: 'finding_winner',
        avg_sales: 0,
        additional_emails: [],
        additional_phones: []
    });

    // Primera nota: se captura aquí para no obligar a crear el cliente, buscarlo y
    // volver a entrar solo para dejar constancia de la conversación inicial.
    const [primeraNota, setPrimeraNota] = useState('');

    // Emails adicionales
    const [additionalEmails, setAdditionalEmails] = useState<string[]>([]);
    const [newEmail, setNewEmail] = useState('');

    // Teléfonos adicionales
    const [additionalPhones, setAdditionalPhones] = useState<string[]>([]);
    const [newPhone, setNewPhone] = useState('');

    const handleChange = (field: keyof CommercialClient, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const addEmail = () => {
        if (newEmail && !additionalEmails.includes(newEmail)) {
            setAdditionalEmails([...additionalEmails, newEmail]);
            setNewEmail('');
        }
    };

    const removeEmail = (email: string) => {
        setAdditionalEmails(additionalEmails.filter(e => e !== email));
    };

    const addPhone = () => {
        if (newPhone && !additionalPhones.includes(newPhone)) {
            setAdditionalPhones([...additionalPhones, newPhone]);
            setNewPhone('');
        }
    };

    const removePhone = (phone: string) => {
        setAdditionalPhones(additionalPhones.filter(p => p !== phone));
    };

    const checkClient = async () => {
        if (!formData.email && !formData.phone) return;
        
        try {
            const result = await checkClientExists(formData.email || '', formData.phone || '', formData.country);
            if (result.exists && result.client) {
                // Obtener nombre del comercial
                const assignedUser = await getUserById(result.client.assigned_commercial_id);
                setExistingClient({
                    exists: true,
                    clientName: result.client.name,
                    assignedTo: assignedUser?.name || 'Otro comercial',
                    clientPhone: result.client.phone,
                    clientEmail: result.client.email,
                    clientCountry: result.client.country,
                    matchedBy: result.matchedBy,
                    mismoPais: result.mismoPais,
                });
            } else {
                setExistingClient(null);
            }
            setIgnorarCoincidencia(false);
        } catch (error) {
            console.error('Error checking client:', error);
        }
    };

    // Cambiar el país cambia el veredicto: la misma coincidencia puede pasar de
    // "duplicado" a "el mismo cliente en otro mercado". Se revisa de nuevo al elegirlo.
    useEffect(() => {
        if (formData.email || formData.phone) checkClient();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formData.country]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setSubmitting(true);
        try {
            if (!formData.country) {
                toast({ title: 'Falta el país', description: 'El país define a qué mercado pertenece la ficha.', variant: 'destructive' });
                setSubmitting(false);
                return;
            }

            // Verificar si el cliente ya existe EN ESTE PAÍS. Un mismo negocio operando
            // en otro país es una ficha aparte, con su propio comercial: esa coincidencia
            // se informa pero no bloquea. Si el país coincide (o no se sabe), se avisa y
            // se puede continuar de forma explícita.
            const result = await checkClientExists(formData.email || '', formData.phone || '', formData.country);
            const otroPais = result.mismoPais === 'distinto';
            if (result.exists && !otroPais && !ignorarCoincidencia) {
                const assignedUser = await getUserById(result.client!.assigned_commercial_id);
                setExistingClient({
                    exists: true,
                    clientName: result.client!.name,
                    assignedTo: assignedUser?.name || 'Otro comercial',
                    clientPhone: result.client!.phone,
                    clientEmail: result.client!.email,
                    clientCountry: result.client!.country,
                    matchedBy: result.matchedBy,
                    mismoPais: result.mismoPais,
                });
                toast({
                    title: "Ese cliente ya está registrado",
                    description: `${result.client!.name} (${result.matchedBy === 'email' ? result.client!.email : result.client!.phone}) ya pertenece a la cartera de ${assignedUser?.name || 'otro comercial'}. Revisa la alerta para continuar de todos modos.`,
                    variant: "destructive"
                });
                setSubmitting(false);
                return;
            }

            // Determinar el comercial asignado
            let assignedCommercialId: string;
            let assignedCommercialName: string;

            if (isAdmin && selectedCommercialId) {
                // Admin seleccionó un comercial específico
                const selectedCommercial = commercials.find(c => c.id === selectedCommercialId);
                assignedCommercialId = selectedCommercialId;
                assignedCommercialName = selectedCommercial?.name || selectedCommercial?.email || 'Comercial';
            } else {
                // Usar el comercial actual (o admin crea para sí mismo)
                const currentUser = await getUserById(user.id);
                assignedCommercialId = user.id;
                assignedCommercialName = currentUser?.name || user.email || 'Comercial';
            }

            const actor = { id: user.id, name: user.name || user.email || 'Usuario' };
            const nuevoClienteId = await createClient({
                ...formData as CommercialClient,
                assigned_commercial_id: assignedCommercialId,
                assigned_commercial_name: assignedCommercialName,
                additional_emails: additionalEmails,
                additional_phones: additionalPhones,
                created_at: new Date(),
                birthday: new Date(formData.birthday || new Date())
            }, actor);

            // La primera nota se guarda con el mismo actor, así que queda con autoría
            // confirmada en el reporte de actividad. Si falla, el cliente ya está creado:
            // se avisa en vez de perder el registro.
            let notaGuardada = true;
            if (primeraNota.trim()) {
                try {
                    await addNoteToClient(nuevoClienteId, primeraNota.trim(), actor);
                } catch (error) {
                    console.error('Cliente creado pero la nota inicial falló:', error);
                    notaGuardada = false;
                }
            }

            toast({
                title: "Cliente registrado",
                description: notaGuardada
                    ? (primeraNota.trim() ? 'Se creó el cliente con su primera nota.' : 'El cliente ha sido creado exitosamente.')
                    : 'El cliente se creó, pero la nota inicial no se pudo guardar. Agrégala desde su ficha.',
                variant: notaGuardada ? 'default' : 'destructive'
            });
            router.push('/commercial/crm/dashboard');
        } catch (error) {
            console.error(error);
            toast({
                title: "Error",
                description: "No se pudo registrar el cliente.",
                variant: "destructive"
            });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <Link href="/commercial/crm/dashboard" className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="mr-2 h-4 w-4" /> Volver al Tablero
            </Link>

            <Card>
                <CardHeader>
                    <CardTitle>Registrar Nuevo Cliente</CardTitle>
                    <CardDescription>Ingresa los datos básicos para iniciar el seguimiento.</CardDescription>
                </CardHeader>
                <CardContent>
                    {/* Coincidencia en OTRO país: no es un duplicado, es el mismo negocio
                        operando en otro mercado con su propio comercial. Se informa y se
                        deja seguir sin fricción. */}
                    {existingClient?.exists && existingClient.mismoPais === 'distinto' && (
                        <Alert className="mb-6">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Este cliente ya opera en otro país</AlertTitle>
                            <AlertDescription className="space-y-1">
                                <p>
                                    <strong>{existingClient.clientName}</strong> está registrado
                                    en <strong>{existingClient.clientCountry}</strong>, en la cartera
                                    de <strong>{existingClient.assignedTo}</strong>.
                                </p>
                                <p className="text-xs opacity-90">
                                    Vas a crear su ficha de <strong>{formData.country}</strong>, que queda a tu
                                    nombre y con su propio historial. Puedes continuar.
                                </p>
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Coincidencia en el mismo país (o sin país registrado): sí es un
                        posible duplicado. Se muestran los datos para poder descartarlo y
                        se permite continuar de forma explícita. */}
                    {existingClient?.exists && existingClient.mismoPais !== 'distinto' && (
                        <Alert variant="destructive" className="mb-6">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>
                                {existingClient.matchedBy === 'email' ? 'Ese correo ya está registrado' : 'Ese teléfono ya está registrado'}
                            </AlertTitle>
                            <AlertDescription className="space-y-2">
                                <p>
                                    Coincide con <strong>{existingClient.clientName}</strong>, de la cartera
                                    de <strong>{existingClient.assignedTo}</strong>.
                                </p>
                                {/* Mostrar los datos del cliente encontrado permite descartar de un
                                    vistazo una coincidencia equivocada, en vez de confiar en el nombre. */}
                                <p className="text-xs opacity-90">
                                    Teléfono registrado: <strong>{existingClient.clientPhone || '—'}</strong>
                                    {' · '}Correo: <strong>{existingClient.clientEmail || '—'}</strong>
                                    {' · '}País: <strong>{existingClient.clientCountry || 'sin registrar'}</strong>
                                </p>
                                {ignorarCoincidencia ? (
                                    <p className="text-xs font-medium">
                                        Marcado como cliente distinto: puedes continuar con el registro.
                                    </p>
                                ) : (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setIgnorarCoincidencia(true)}
                                    >
                                        No es el mismo cliente, registrar de todos modos
                                    </Button>
                                )}
                            </AlertDescription>
                        </Alert>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Nombre Completo</Label>
                                <Input
                                    id="name"
                                    required
                                    value={formData.name}
                                    onChange={(e) => handleChange('name', e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Correo Electrónico Principal</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    required
                                    value={formData.email}
                                    onChange={(e) => handleChange('email', e.target.value)}
                                    onBlur={checkClient}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="phone">Celular Principal</Label>
                                <Input
                                    id="phone"
                                    required
                                    value={formData.phone}
                                    onChange={(e) => handleChange('phone', e.target.value)}
                                    onBlur={checkClient}
                                />
                            </div>

                            {/* Emails adicionales */}
                            <div className="space-y-2 md:col-span-2">
                                <Label>Correos Electrónicos Adicionales</Label>
                                <div className="flex gap-2">
                                    <Input
                                        type="email"
                                        placeholder="Agregar email adicional"
                                        value={newEmail}
                                        onChange={(e) => setNewEmail(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addEmail())}
                                    />
                                    <Button type="button" variant="outline" onClick={addEmail} size="icon">
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </div>
                                {additionalEmails.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {additionalEmails.map((email) => (
                                            <span key={email} className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded text-sm">
                                                {email}
                                                <button type="button" onClick={() => removeEmail(email)} className="hover:text-red-500">
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Teléfonos adicionales */}
                            <div className="space-y-2 md:col-span-2">
                                <Label>Teléfonos Adicionales</Label>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Agregar teléfono adicional"
                                        value={newPhone}
                                        onChange={(e) => setNewPhone(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addPhone())}
                                    />
                                    <Button type="button" variant="outline" onClick={addPhone} size="icon">
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </div>
                                {additionalPhones.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {additionalPhones.map((phone) => (
                                            <span key={phone} className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded text-sm">
                                                {phone}
                                                <button type="button" onClick={() => removePhone(phone)} className="hover:text-red-500">
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="city">Ciudad</Label>
                                <Input
                                    id="city"
                                    required
                                    value={formData.city}
                                    onChange={(e) => handleChange('city', e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="country">País</Label>
                                {/* Sin valor por defecto y obligatorio: el país determina de qué
                                    mercado es la ficha, y un mismo cliente puede tener una por país
                                    con un comercial distinto en cada una. */}
                                <Select value={formData.country || ''} onValueChange={(val) => handleChange('country', val)}>
                                    <SelectTrigger id="country">
                                        <SelectValue placeholder="Seleccionar país..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PAISES.map(p => (
                                            <SelectItem key={p} value={p}>{etiquetaPais(p)}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="category">Categoría</Label>
                                <Select value={formData.category} onValueChange={(val) => handleChange('category', val)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="laboratorio">Laboratorio</SelectItem>
                                        <SelectItem value="chino">Chino</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="type">Tipo de Cliente</Label>
                                <Select value={formData.type} onValueChange={(val) => handleChange('type', val)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="dropshipper">Dropshipper</SelectItem>
                                        <SelectItem value="ecommerce">E-commerce</SelectItem>
                                        <SelectItem value="mixto">Mixto</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="birthday">Fecha Cumpleaños</Label>
                                <Input
                                    id="birthday"
                                    type="date"
                                    onChange={(e) => handleChange('birthday', e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="avg_sales">Ventas Promedio ($)</Label>
                                <Input
                                    id="avg_sales"
                                    type="number"
                                    value={formData.avg_sales}
                                    onChange={(e) => handleChange('avg_sales', Number(e.target.value))}
                                />
                            </div>
                            
                            {/* Selector de comercial (solo para admins) */}
                            {isAdmin && (
                                <div className="space-y-2 md:col-span-2">
                                    <Label htmlFor="assigned_commercial">Asignar a Comercial</Label>
                                    <Select 
                                        value={selectedCommercialId} 
                                        onValueChange={setSelectedCommercialId}
                                        disabled={loadingCommercials}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder={loadingCommercials ? "Cargando comerciales..." : "Seleccionar comercial..."} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={user?.id || ''}>
                                                Yo mismo ({user?.name || user?.email})
                                            </SelectItem>
                                            {commercials.map((commercial) => (
                                                <SelectItem key={commercial.id} value={commercial.id}>
                                                    {commercial.name || commercial.email} ({commercial.role === 'commercial_director' ? 'Director' : 'Comercial'})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>

                        {/* Primera conversación. Evita el rodeo de crear el cliente, buscarlo
                            en el tablero y entrar a su ficha solo para dejar la nota inicial. */}
                        <div className="space-y-2 pt-2">
                            <Label htmlFor="primeraNota">Primera nota (opcional)</Label>
                            <Textarea
                                id="primeraNota"
                                rows={3}
                                placeholder="¿Qué hablaste con el cliente? Queda registrado a tu nombre en su historial."
                                value={primeraNota}
                                onChange={(e) => setPrimeraNota(e.target.value)}
                            />
                        </div>

                        <div className="pt-4 flex justify-end">
                            <Button type="submit" disabled={submitting} className="w-full md:w-auto">
                                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Registrar Cliente
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
