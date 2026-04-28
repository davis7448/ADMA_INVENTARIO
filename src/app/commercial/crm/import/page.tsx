"use client";

import { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Upload, CheckCircle, XCircle, AlertCircle, FileSpreadsheet, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { getUsers } from '@/lib/api';
import { createClient, checkClientExists } from '@/lib/commercial-api';
import { useToast } from '@/hooks/use-toast';
import type { User } from '@/lib/types';
import type { CommercialClient, ClientStatus, ClientCategory, ClientType } from '@/types/commercial';

// ─── Mapeos de valores del Excel ───────────────────────────────────────────

function mapStatus(raw: string): ClientStatus {
    const s = (raw ?? '').toLowerCase().trim();
    if (s.includes('vendiendo')) return 'selling';
    if (s.includes('testeando') || s.includes('testing')) return 'testing';
    if (s.includes('escalando') || s.includes('scaling')) return 'scaling';
    if (s.includes('winner') || s.includes('encontrando')) return 'finding_winner';
    return 'finding_winner';
}

function mapCategory(raw: string): ClientCategory {
    const s = (raw ?? '').toLowerCase().trim();
    if (s.includes('chino')) return 'chino';
    return 'laboratorio';
}

function mapType(raw: string): ClientType {
    const s = (raw ?? '').toLowerCase().trim();
    if (s.includes('dropship')) return 'dropshipper';
    if (s.includes('ecommerce') || s.includes('e-commerce')) return 'ecommerce';
    return 'mixto';
}

const STATUS_LABELS: Record<ClientStatus, string> = {
    finding_winner: 'Encontrando Winner',
    testing: 'Testeando',
    selling: 'Vendiendo',
    scaling: 'Escalando',
};

// ─── Tipos internos ────────────────────────────────────────────────────────

interface ParsedRow {
    rowIndex: number;
    name: string;
    email: string;
    phone: string;
    city: string;
    category: ClientCategory;
    type: ClientType;
    status: ClientStatus;
    errors: string[];
    valid: boolean;
}

type ImportResultStatus = 'created' | 'skipped' | 'error';

interface ImportResult {
    rowIndex: number;
    name: string;
    status: ImportResultStatus;
    message: string;
}

// ─── Componente principal ──────────────────────────────────────────────────

export default function ImportClientsPage() {
    const { user } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [commercials, setCommercials] = useState<User[]>([]);
    const [selectedCommercialId, setSelectedCommercialId] = useState('');
    const [loadingCommercials, setLoadingCommercials] = useState(false);
    const [fileName, setFileName] = useState('');
    const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
    const [importing, setImporting] = useState(false);
    const [importProgress, setImportProgress] = useState(0);
    const [importResults, setImportResults] = useState<ImportResult[]>([]);

    const isAdmin = user?.role === 'admin' || user?.role === 'commercial_director';

    useEffect(() => {
        if (!isAdmin) return;
        setLoadingCommercials(true);
        getUsers()
            .then(users => {
                setCommercials(
                    users.filter(u => u.role === 'commercial' || u.role === 'commercial_director')
                );
            })
            .finally(() => setLoadingCommercials(false));
    }, [isAdmin]);

    // Redirigir si no es admin
    if (user && !isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
                <XCircle className="h-12 w-12 text-destructive" />
                <p className="text-lg font-medium">Sin permiso para acceder a esta página.</p>
                <Button asChild variant="outline">
                    <Link href="/commercial/crm/dashboard">Volver al CRM</Link>
                </Button>
            </div>
        );
    }

    // ── Parser de Excel ──────────────────────────────────────────────────

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        setFileName(file.name);

        const reader = new FileReader();
        reader.onload = (evt) => {
            const data = evt.target?.result;
            const wb = XLSX.read(data, { type: 'array' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

            // Detectar fila de encabezados (primera fila)
            const rows = raw.slice(1); // saltear headers
            const parsed: ParsedRow[] = rows.map((row, i) => {
                const errors: string[] = [];

                // Col 0: email, Col 1: name, Col 2: phone,
                // Col 3: status, Col 4: city, Col 5: type, Col 6: category
                const email = String(row[0] ?? '').trim();
                const name = String(row[1] ?? '').trim();
                const phone = String(row[2] ?? '').trim();
                const rawStatus = String(row[3] ?? '').trim();
                const city = String(row[4] ?? '').trim() || 'Cali';
                const rawType = String(row[5] ?? '').trim();
                const rawCategory = String(row[6] ?? '').trim();

                if (!name) errors.push('Nombre vacío');
                if (!email) errors.push('Email vacío');
                if (!phone) errors.push('Teléfono vacío');

                return {
                    rowIndex: i + 2, // número de fila en el Excel (1-indexed + header)
                    name: name || `Fila ${i + 2}`,
                    email,
                    phone,
                    city: city.charAt(0).toUpperCase() + city.slice(1),
                    category: mapCategory(rawCategory),
                    type: mapType(rawType),
                    status: mapStatus(rawStatus),
                    errors,
                    valid: errors.length === 0,
                };
            });

            setParsedRows(parsed.filter(r => r.name !== '' || r.email !== '' || r.phone !== ''));
            setStep(2);
        };
        reader.readAsArrayBuffer(file);
    }

    // ── Importación ──────────────────────────────────────────────────────

    async function handleImport() {
        if (!selectedCommercialId) {
            toast({ title: 'Selecciona un comercial', variant: 'destructive' });
            return;
        }

        const validRows = parsedRows.filter(r => r.valid);
        if (validRows.length === 0) {
            toast({ title: 'No hay filas válidas para importar', variant: 'destructive' });
            return;
        }

        const commercial = commercials.find(c => c.id === selectedCommercialId);
        const commercialName = commercial?.name || commercial?.email || 'Comercial';

        setImporting(true);
        setImportProgress(0);
        const results: ImportResult[] = [];

        for (let i = 0; i < validRows.length; i++) {
            const row = validRows[i];
            try {
                const existing = await checkClientExists(row.email, row.phone);
                if (existing.exists) {
                    results.push({
                        rowIndex: row.rowIndex,
                        name: row.name,
                        status: 'skipped',
                        message: `Ya existe (asignado a ${existing.client?.assigned_commercial_name ?? 'otro comercial'})`,
                    });
                } else {
                    await createClient({
                        name: row.name,
                        email: row.email,
                        phone: row.phone,
                        city: row.city,
                        category: row.category,
                        type: row.type,
                        status: row.status,
                        avg_sales: 0,
                        birthday: new Date(),
                        additional_emails: [],
                        additional_phones: [],
                        assigned_commercial_id: selectedCommercialId,
                        assigned_commercial_name: commercialName,
                        created_at: new Date(),
                    });
                    results.push({
                        rowIndex: row.rowIndex,
                        name: row.name,
                        status: 'created',
                        message: 'Importado correctamente',
                    });
                }
            } catch (err: any) {
                results.push({
                    rowIndex: row.rowIndex,
                    name: row.name,
                    status: 'error',
                    message: err?.message ?? 'Error desconocido',
                });
            }

            setImportProgress(Math.round(((i + 1) / validRows.length) * 100));
        }

        // Incluir filas inválidas como skipped
        parsedRows.filter(r => !r.valid).forEach(r => {
            results.push({
                rowIndex: r.rowIndex,
                name: r.name,
                status: 'skipped',
                message: `Omitido: ${r.errors.join(', ')}`,
            });
        });

        results.sort((a, b) => a.rowIndex - b.rowIndex);
        setImportResults(results);
        setImporting(false);
        setStep(3);
    }

    // ── Resumen de resultados ─────────────────────────────────────────────

    const created = importResults.filter(r => r.status === 'created').length;
    const skipped = importResults.filter(r => r.status === 'skipped').length;
    const errors = importResults.filter(r => r.status === 'error').length;
    const validCount = parsedRows.filter(r => r.valid).length;
    const invalidCount = parsedRows.filter(r => !r.valid).length;
    const selectedCommercialName = commercials.find(c => c.id === selectedCommercialId)?.name
        || commercials.find(c => c.id === selectedCommercialId)?.email
        || '—';

    // ─── Render ─────────────────────────────────────────────────────────

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/commercial/crm/dashboard">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                </Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Importar Clientes desde Excel</h1>
                    <p className="text-sm text-muted-foreground">Carga masiva de clientes para un comercial.</p>
                </div>
            </div>

            {/* Indicador de pasos */}
            <div className="flex items-center gap-2 text-sm">
                {(['1. Cargar archivo', '2. Previsualizar', '3. Resultado'] as const).map((label, idx) => {
                    const stepNum = (idx + 1) as 1 | 2 | 3;
                    const active = step === stepNum;
                    const done = step > stepNum;
                    return (
                        <div key={label} className="flex items-center gap-2">
                            <span className={`px-3 py-1 rounded-full font-medium transition-colors ${
                                done ? 'bg-green-100 text-green-700' :
                                active ? 'bg-primary text-white' :
                                'bg-muted text-muted-foreground'
                            }`}>
                                {done ? '✓ ' : ''}{label}
                            </span>
                            {idx < 2 && <span className="text-muted-foreground">→</span>}
                        </div>
                    );
                })}
            </div>

            {/* ── PASO 1: Cargar archivo ─────────────────────────────────── */}
            {step === 1 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Selecciona el comercial y el archivo</CardTitle>
                        <CardDescription>
                            El archivo debe tener columnas: CORREO TIENDA, COMERCIO, CELULAR PRINCIPAL,
                            ESTADO DE LOS COMERCIOS, CIUDAD, TIPO DE CLIENTE, CATEGORÍA, COMERCIAL QUE LO RECIBE.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label>Asignar clientes a</Label>
                            <Select
                                value={selectedCommercialId}
                                onValueChange={setSelectedCommercialId}
                                disabled={loadingCommercials}
                            >
                                <SelectTrigger className="max-w-sm">
                                    <SelectValue placeholder={loadingCommercials ? 'Cargando...' : 'Seleccionar comercial...'} />
                                </SelectTrigger>
                                <SelectContent>
                                    {commercials.map(c => (
                                        <SelectItem key={c.id} value={c.id}>
                                            {c.name || c.email}
                                            {c.role === 'commercial_director' && (
                                                <span className="ml-1 text-xs text-muted-foreground">(Director)</span>
                                            )}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div
                            className="border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer hover:bg-muted/30 transition-colors"
                            onClick={() => selectedCommercialId && fileInputRef.current?.click()}
                        >
                            <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />
                            <p className="font-medium text-center">
                                {selectedCommercialId
                                    ? 'Haz clic aquí para seleccionar el archivo Excel (.xlsx, .xls)'
                                    : 'Primero selecciona un comercial'}
                            </p>
                            <p className="text-xs text-muted-foreground">Solo se lee la primera hoja del libro</p>
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx,.xls"
                            className="hidden"
                            onChange={handleFileChange}
                        />
                    </CardContent>
                </Card>
            )}

            {/* ── PASO 2: Previsualizar ──────────────────────────────────── */}
            {step === 2 && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                            <span className="font-medium text-sm">{fileName}</span>
                            <Badge variant="secondary">{parsedRows.length} filas detectadas</Badge>
                            {invalidCount > 0 && (
                                <Badge variant="destructive">{invalidCount} con errores</Badge>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => { setStep(1); setParsedRows([]); setFileName(''); }}>
                                Cambiar archivo
                            </Button>
                            <Button
                                size="sm"
                                disabled={!selectedCommercialId || validCount === 0}
                                onClick={handleImport}
                            >
                                Importar {validCount} clientes →
                            </Button>
                        </div>
                    </div>

                    {/* Alerta de comercial seleccionado */}
                    <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            Se importarán <strong>{validCount}</strong> clientes asignados a{' '}
                            <strong>{selectedCommercialName}</strong>.
                            {invalidCount > 0 && ` Se omitirán ${invalidCount} filas con errores.`}
                        </AlertDescription>
                    </Alert>

                    {/* Tabla de previsualización */}
                    <Card>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="border-b bg-muted/50">
                                        <tr>
                                            <th className="text-left p-3 font-medium text-muted-foreground w-10">#</th>
                                            <th className="text-left p-3 font-medium text-muted-foreground">Nombre</th>
                                            <th className="text-left p-3 font-medium text-muted-foreground">Email</th>
                                            <th className="text-left p-3 font-medium text-muted-foreground">Teléfono</th>
                                            <th className="text-left p-3 font-medium text-muted-foreground">Ciudad</th>
                                            <th className="text-left p-3 font-medium text-muted-foreground">Estado</th>
                                            <th className="text-left p-3 font-medium text-muted-foreground">Tipo</th>
                                            <th className="text-left p-3 font-medium text-muted-foreground">Categoría</th>
                                            <th className="text-left p-3 font-medium text-muted-foreground w-8"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {parsedRows.map(row => (
                                            <tr
                                                key={row.rowIndex}
                                                className={`border-b last:border-0 ${row.valid ? '' : 'bg-red-50/60'}`}
                                            >
                                                <td className="p-3 text-muted-foreground">{row.rowIndex}</td>
                                                <td className="p-3 font-medium">{row.name}</td>
                                                <td className="p-3 text-muted-foreground">
                                                    {row.email || <span className="text-destructive text-xs">Vacío</span>}
                                                </td>
                                                <td className="p-3 text-muted-foreground">{row.phone}</td>
                                                <td className="p-3 text-muted-foreground">{row.city}</td>
                                                <td className="p-3">
                                                    <Badge variant="outline" className="text-[10px]">
                                                        {STATUS_LABELS[row.status]}
                                                    </Badge>
                                                </td>
                                                <td className="p-3 text-muted-foreground capitalize">{row.type}</td>
                                                <td className="p-3 text-muted-foreground capitalize">{row.category}</td>
                                                <td className="p-3">
                                                    {row.valid
                                                        ? <CheckCircle className="h-4 w-4 text-green-500" />
                                                        : (
                                                            <div title={row.errors.join(', ')}>
                                                                <XCircle className="h-4 w-4 text-destructive cursor-help" />
                                                            </div>
                                                        )
                                                    }
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Errores detallados */}
                    {invalidCount > 0 && (
                        <Alert variant="destructive">
                            <XCircle className="h-4 w-4" />
                            <AlertDescription>
                                <p className="font-medium mb-1">Filas que serán omitidas:</p>
                                <ul className="text-xs space-y-0.5">
                                    {parsedRows.filter(r => !r.valid).map(r => (
                                        <li key={r.rowIndex}>
                                            Fila {r.rowIndex} — {r.name}: {r.errors.join(', ')}
                                        </li>
                                    ))}
                                </ul>
                            </AlertDescription>
                        </Alert>
                    )}
                </div>
            )}

            {/* ── PASO 3: Resultados ────────────────────────────────────── */}
            {step === 3 && (
                <div className="space-y-4">
                    {importing ? (
                        <Card>
                            <CardContent className="py-10 flex flex-col items-center gap-4">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                <p className="font-medium">Importando clientes... {importProgress}%</p>
                                <Progress value={importProgress} className="w-full max-w-md" />
                            </CardContent>
                        </Card>
                    ) : (
                        <>
                            {/* Resumen */}
                            <div className="grid grid-cols-3 gap-4">
                                <Card className="border-green-200 bg-green-50/50">
                                    <CardContent className="pt-6 pb-4 flex flex-col items-center gap-1">
                                        <CheckCircle className="h-8 w-8 text-green-600" />
                                        <p className="text-3xl font-bold text-green-700">{created}</p>
                                        <p className="text-sm text-green-600 font-medium">Importados</p>
                                    </CardContent>
                                </Card>
                                <Card className="border-yellow-200 bg-yellow-50/50">
                                    <CardContent className="pt-6 pb-4 flex flex-col items-center gap-1">
                                        <AlertCircle className="h-8 w-8 text-yellow-600" />
                                        <p className="text-3xl font-bold text-yellow-700">{skipped}</p>
                                        <p className="text-sm text-yellow-600 font-medium">Omitidos</p>
                                    </CardContent>
                                </Card>
                                <Card className="border-red-200 bg-red-50/50">
                                    <CardContent className="pt-6 pb-4 flex flex-col items-center gap-1">
                                        <XCircle className="h-8 w-8 text-red-600" />
                                        <p className="text-3xl font-bold text-red-700">{errors}</p>
                                        <p className="text-sm text-red-600 font-medium">Errores</p>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Detalle fila por fila */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">Detalle de la importación</CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="border-b bg-muted/50">
                                                <tr>
                                                    <th className="text-left p-3 font-medium text-muted-foreground w-10">#</th>
                                                    <th className="text-left p-3 font-medium text-muted-foreground">Cliente</th>
                                                    <th className="text-left p-3 font-medium text-muted-foreground">Resultado</th>
                                                    <th className="text-left p-3 font-medium text-muted-foreground">Detalle</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {importResults.map(r => (
                                                    <tr key={r.rowIndex} className="border-b last:border-0">
                                                        <td className="p-3 text-muted-foreground">{r.rowIndex}</td>
                                                        <td className="p-3 font-medium">{r.name}</td>
                                                        <td className="p-3">
                                                            {r.status === 'created' && (
                                                                <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                                                                    ✓ Importado
                                                                </Badge>
                                                            )}
                                                            {r.status === 'skipped' && (
                                                                <Badge variant="outline" className="text-yellow-700 border-yellow-300">
                                                                    Omitido
                                                                </Badge>
                                                            )}
                                                            {r.status === 'error' && (
                                                                <Badge variant="destructive">Error</Badge>
                                                            )}
                                                        </td>
                                                        <td className="p-3 text-xs text-muted-foreground">{r.message}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>

                            <div className="flex justify-end gap-3">
                                <Button variant="outline" onClick={() => { setStep(1); setParsedRows([]); setFileName(''); setImportResults([]); }}>
                                    Nueva importación
                                </Button>
                                <Button asChild>
                                    <Link href="/commercial/crm/dashboard">Ver CRM</Link>
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
