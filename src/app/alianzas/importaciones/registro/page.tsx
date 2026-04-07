"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getImportRequests, updateImportRequestStatus } from '@/lib/api';
import { ImportRequest } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function ImportTrackingPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [importRequests, setImportRequests] = useState<ImportRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadImportRequests();
  }, []);

  const loadImportRequests = async () => {
    try {
      const requests = await getImportRequests();
      setImportRequests(requests);
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudieron cargar las solicitudes de importación.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (requestId: string, newStatus: ImportRequest['status']) => {
    try {
      await updateImportRequestStatus(requestId, newStatus);
      setImportRequests(prev =>
        prev.map(req =>
          req.id === requestId ? { ...req, status: newStatus } : req
        )
      );
      toast({
        title: "Estado actualizado",
        description: "El estado de la solicitud ha sido actualizado exitosamente.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo actualizar el estado de la solicitud.",
        variant: "destructive",
      });
    }
  };

  const getStatusBadgeVariant = (status: ImportRequest['status']) => {
    switch (status) {
      case 'solicitado':
        return 'secondary';
      case 'en_proceso':
        return 'default';
      case 'completado':
        return 'default';
      case 'cancelado':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getStatusLabel = (status: ImportRequest['status']) => {
    switch (status) {
      case 'solicitado':
        return 'Solicitado';
      case 'en_proceso':
        return 'En Proceso';
      case 'completado':
        return 'Completado';
      case 'cancelado':
        return 'Cancelado';
      default:
        return status;
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex justify-center">
          <div className="text-lg">Cargando solicitudes...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Registro de Importaciones</CardTitle>
        </CardHeader>
        <CardContent>
          {importRequests.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No hay solicitudes de importación registradas.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha Solicitud</TableHead>
                  <TableHead>Solicitante</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Imagen</TableHead>
                  <TableHead>Link de Referencia</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      {format(new Date(request.requestDate), 'dd/MM/yyyy', { locale: es })}
                    </TableCell>
                    <TableCell>{request.requestedBy.name}</TableCell>
                    <TableCell>
                      <div className="font-medium">{request.productName}</div>
                    </TableCell>
                    <TableCell>
                      {request.imageUrl ? (
                        <img
                          src={request.imageUrl}
                          alt={request.productName}
                          className="w-12 h-12 object-cover rounded border"
                        />
                      ) : (
                        <span className="text-muted-foreground">Sin imagen</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {request.referenceLink ? (
                        <a
                          href={request.referenceLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 underline"
                        >
                          Ver enlace
                        </a>
                      ) : (
                        <span className="text-muted-foreground">No disponible</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(request.status)}>
                        {getStatusLabel(request.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={request.status}
                        onValueChange={(value: ImportRequest['status']) =>
                          handleStatusChange(request.id, value)
                        }
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="solicitado">Solicitado</SelectItem>
                          <SelectItem value="en_proceso">En Proceso</SelectItem>
                          <SelectItem value="completado">Completado</SelectItem>
                          <SelectItem value="cancelado">Cancelado</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}