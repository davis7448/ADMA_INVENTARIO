

"use client";

import { useState, useEffect, useTransition } from 'react';
import type { CancellationRequest } from '@/lib/types';
import { AuthProviderWrapper } from '@/components/auth-provider-wrapper';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { getCancellationRequests, createCancellationRequests } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { formatToTimeZone } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

function CancellationsContent() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [requests, setRequests] = useState<CancellationRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, startTransition] = useTransition();
    const [guidesToCancel, setGuidesToCancel] = useState('');
    const [submissionWarnings, setSubmissionWarnings] = useState<string[]>([]);

    const fetchRequests = async () => {
        setLoading(true);
        const fetchedRequests = await getCancellationRequests();
        setRequests(fetchedRequests);
        setLoading(false);
    }

    useEffect(() => {
        fetchRequests();
    }, []);

    const handleSubmit = () => {
        if (!user) return;
        
        const trackingNumbers = guidesToCancel.split('\n').map(tn => tn.trim()).filter(Boolean);
        if (trackingNumbers.length === 0) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Por favor, introduce al menos un número de guía.'
            });
            return;
        }

        startTransition(async () => {
            setSubmissionWarnings([]);
            try {
                const { alreadyDispatched } = await createCancellationRequests(trackingNumbers, user);

                toast({
                    title: 'Solicitud Enviada',
                    description: `Se han procesado ${trackingNumbers.length} guías.`
                });
                
                if (alreadyDispatched.length > 0) {
                    setSubmissionWarnings(alreadyDispatched);
                }

                setGuidesToCancel('');
                fetchRequests(); // Refresh the list

            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
                toast({
                    variant: 'destructive',
                    title: 'Error al Crear Solicitud',
                    description: errorMessage
                });
            }
        });
    };

    const getStatusBadge = (status: 'pending' | 'completed' | 'rejected') => {
        switch (status) {
            case 'pending':
                return <Badge variant="secondary">Pendiente</Badge>;
            case 'completed':
                return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300">Anulada</Badge>;
            case 'rejected':
                return <Badge variant="destructive">Rechazada</Badge>;
            default:
                return <Badge variant="outline">Desconocido</Badge>;
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold font-headline tracking-tight">Solicitud de Anulación de Guías</h1>
                <p className="text-muted-foreground">Envía un listado de guías para solicitar su anulación en el sistema.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Nueva Solicitud de Anulación</CardTitle>
                    <CardDescription>Pega aquí la lista de números de guía que deseas anular, una por línea.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <Label htmlFor="guides-textarea">Números de Guía</Label>
                        <Textarea
                            id="guides-textarea"
                            placeholder="GUIA001\nGUIA002\nGUIA003..."
                            rows={8}
                            value={guidesToCancel}
                            onChange={(e) => setGuidesToCancel(e.target.value)}
                        />
                    </div>
                     {submissionWarnings.length > 0 && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Advertencia: Guías Ya Despachadas</AlertTitle>
                            <AlertDescription>
                                Las siguientes guías ya han sido despachadas. Su anulación no es segura y debe ser verificada manualmente:
                                <ul className="list-disc pl-5 mt-2">
                                    {submissionWarnings.map(tn => <li key={tn} className="font-mono">{tn}</li>)}
                                </ul>
                            </AlertDescription>
                        </Alert>
                    )}
                </CardContent>
                <CardFooter>
                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? 'Enviando Solicitud...' : 'Enviar Solicitud de Anulación'}
                    </Button>
                </CardFooter>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Historial de Solicitudes</CardTitle>
                    <CardDescription>Un registro de todas las solicitudes de anulación.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Fecha de Solicitud</TableHead>
                                <TableHead>Número de Guía</TableHead>
                                <TableHead>Solicitado por</TableHead>
                                <TableHead>Estado</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell colSpan={4}><Skeleton className="h-8 w-full" /></TableCell>
                                    </TableRow>
                                ))
                            ) : requests.length > 0 ? (
                                requests.map(req => (
                                    <TableRow key={req.id}>
                                        <TableCell>{formatToTimeZone(new Date(req.requestDate), 'dd/MM/yyyy HH:mm')}</TableCell>
                                        <TableCell className="font-mono">{req.trackingNumber}</TableCell>
                                        <TableCell>{req.requestedBy.name}</TableCell>
                                        <TableCell>{getStatusBadge(req.status)}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">No hay solicitudes de anulación.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}

export default function CancellationsPage() {
    return (
        <AuthProviderWrapper allowedRoles={['admin', 'commercial']}>
            <CancellationsContent />
        </AuthProviderWrapper>
    )
}
