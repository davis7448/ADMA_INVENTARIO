"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Package, 
  CheckCircle2, 
  XCircle,
  Clock,
  ExternalLink,
  Image as ImageIcon,
  Eye,
  Filter
} from "lucide-react";
import { 
  getDropshippingRequests,
  approveDropshippingRequest,
  rejectDropshippingRequest 
} from "@/app/actions/dropshipping";

export default function DropshippingAdminPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<any[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  
  // Approval/Rejection form
  const [responseText, setResponseText] = useState("");
  const [approvedQuantity, setApprovedQuantity] = useState("");
  const [approvedModality, setApprovedModality] = useState<"dropshipping" | "bulk" | "both">("dropshipping");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadRequests();
  }, [user]);

  useEffect(() => {
    loadRequests();
  }, [filter]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const result = await getDropshippingRequests(
        filter !== "all" ? { status: filter as any } : undefined
      );
      if (result.success && result.requests) {
        setRequests(result.requests);
      }
    } catch (error) {
      console.error("Error loading requests:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedRequest) return;
    if (!approvedQuantity) {
      toast({ title: "Error", description: "Ingresa la cantidad aprobada", variant: "destructive" });
      return;
    }

    setProcessing(true);
    const result = await approveDropshippingRequest({
      requestId: selectedRequest.id,
      approvedQuantity: parseInt(approvedQuantity),
      approvedModality,
      adminResponse: responseText,
    });
    setProcessing(false);

    if (result.success) {
      toast({ title: "Solicitud aprobada", description: "El usuario será notificado" });
      setSelectedRequest(null);
      setResponseText("");
      setApprovedQuantity("");
      loadRequests();
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;
    if (!responseText) {
      toast({ title: "Error", description: "Ingresa la razón del rechazo", variant: "destructive" });
      return;
    }

    setProcessing(true);
    const result = await rejectDropshippingRequest({
      requestId: selectedRequest.id,
      adminResponse: responseText,
    });
    setProcessing(false);

    if (result.success) {
      toast({ title: "Solicitud rechazada", description: "El usuario será notificado" });
      setSelectedRequest(null);
      setResponseText("");
      loadRequests();
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="text-yellow-600"><Clock className="mr-1 h-3 w-3" /> Pendiente</Badge>;
      case "approved":
        return <Badge className="bg-green-600"><CheckCircle2 className="mr-1 h-3 w-3" /> Aprobada</Badge>;
      case "rejected":
        return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" /> Rechazada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (!user || (user.role !== 'admin' && user.role !== 'commercial')) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <XCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
            <h2 className="text-xl font-bold">Acceso denegado</h2>
            <p className="text-muted-foreground mt-2">
              No tienes permiso para acceder a esta página.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Administración Dropshipping</h1>
          <p className="text-muted-foreground mt-1">
            Revisa y aprueba las sugerencias de productos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-lg px-4 py-1">
            {requests.filter(r => r.status === 'pending').length} pendientes
          </Badge>
        </div>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
        <TabsList>
          <TabsTrigger value="all">Todas</TabsTrigger>
          <TabsTrigger value="pending">Pendientes</TabsTrigger>
          <TabsTrigger value="approved">Aprobadas</TabsTrigger>
          <TabsTrigger value="rejected">Rechazadas</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Request List */}
        <Card>
          <CardHeader>
            <CardTitle>Solicitudes</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
              </div>
            ) : requests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No hay solicitudes</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {requests.map((request) => (
                  <div
                    key={request.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedRequest?.id === request.id 
                        ? "border-primary bg-primary/5" 
                        : "hover:bg-muted/50"
                    }`}
                    onClick={() => setSelectedRequest(request)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      {getStatusBadge(request.status)}
                      <span className="text-xs text-muted-foreground">
                        {request.createdAt?.toLocaleDateString()}
                      </span>
                    </div>
                    <div className="text-sm space-y-1">
                      <p><strong>Cantidad:</strong> {request.quantity} | <strong>País:</strong> {request.country}</p>
                      <p><strong>Modalidad:</strong> {request.modality}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Request Detail & Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Detalles de Solicitud</CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedRequest ? (
              <div className="text-center py-12 text-muted-foreground">
                <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Selecciona una solicitud para ver los detalles</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Request Info */}
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Estado</span>
                    {getStatusBadge(selectedRequest.status)}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Usuario</span>
                    <span>{selectedRequest.userId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cantidad solicitada</span>
                    <span>{selectedRequest.quantity}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">País</span>
                    <span>{selectedRequest.country}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Modalidad</span>
                    <span className="capitalize">{selectedRequest.modality}</span>
                  </div>
                  {selectedRequest.productLink && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Link</span>
                      <a 
                        href={selectedRequest.productLink} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline flex items-center gap-1"
                      >
                        Ver producto <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                  {selectedRequest.observations && (
                    <div>
                      <span className="text-muted-foreground block mb-1">Observaciones</span>
                      <p className="text-sm">{selectedRequest.observations}</p>
                    </div>
                  )}
                </div>

                {selectedRequest.status === 'pending' && (
                  <>
                    <Separator />
                    
                    {/* Approval Form */}
                    <div className="space-y-4">
                      <h4 className="font-medium">Responder Solicitud</h4>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Cantidad aprobada</Label>
                          <Input
                            type="number"
                            value={approvedQuantity}
                            onChange={(e) => setApprovedQuantity(e.target.value)}
                            placeholder={selectedRequest.quantity.toString()}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Modalidad</Label>
                          <Select
                            value={approvedModality}
                            onValueChange={(v: any) => setApprovedModality(v)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="dropshipping">Dropshipping</SelectItem>
                              <SelectItem value="bulk">Por mayor</SelectItem>
                              <SelectItem value="both">Ambas</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Respuesta</Label>
                        <Textarea
                          value={responseText}
                          onChange={(e) => setResponseText(e.target.value)}
                          placeholder="Escribe una respuesta al usuario..."
                          rows={3}
                        />
                      </div>

                      <div className="flex gap-2">
                        <Button 
                          className="flex-1 bg-green-600 hover:bg-green-700"
                          onClick={handleApprove}
                          disabled={processing}
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Aprobar
                        </Button>
                        <Button 
                          variant="destructive"
                          className="flex-1"
                          onClick={handleReject}
                          disabled={processing}
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Rechazar
                        </Button>
                      </div>
                    </div>
                  </>
                )}

                {/* Show admin response if already processed */}
                {selectedRequest.adminResponse && (
                  <>
                    <Separator />
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <p className="text-sm font-medium mb-1">Tu respuesta:</p>
                      <p className="text-sm">{selectedRequest.adminResponse}</p>
                      {selectedRequest.approvedQuantity && (
                        <p className="text-sm text-green-600 mt-2">
                          <CheckCircle2 className="inline h-3 w-3 mr-1" />
                          {selectedRequest.approvedQuantity} unidades - {selectedRequest.approvedModality}
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
