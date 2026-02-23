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
import { 
  Package, 
  Upload, 
  Globe, 
  CheckCircle2, 
  XCircle,
  Clock,
  ExternalLink,
  Image as ImageIcon,
  FileUp
} from "lucide-react";
import { submitDropshippingRequest, getDropshippingRequests } from "@/app/actions/dropshipping";

export default function DropshippingPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    productLink: "",
    quantity: "",
    country: "",
    observations: "",
    modality: "dropshipping" as "dropshipping" | "bulk" | "both",
    imageUrl: "",
  });

  useEffect(() => {
    loadMyRequests();
  }, [user]);

  const loadMyRequests = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      const result = await getDropshippingRequests({ userId: user.id });
      if (result.success && result.requests) {
        setMyRequests(result.requests);
      }
    } catch (error) {
      console.error("Error loading requests:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    setSubmitting(true);
    
    const result = await submitDropshippingRequest({
      ...formData,
      quantity: parseInt(formData.quantity),
      userId: user.id,
    });
    
    setSubmitting(false);

    if (result.success) {
      toast({
        title: "Solicitud enviada",
        description: "Tu sugerencia ha sido enviada. Te notificaremos cuando sea revisada.",
      });
      setFormData({
        productLink: "",
        quantity: "",
        country: "",
        observations: "",
        modality: "dropshipping",
        imageUrl: "",
      });
      loadMyRequests();
    } else {
      toast({
        title: "Error",
        description: result.message,
        variant: "destructive",
      });
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

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dropshipping</h1>
          <p className="text-muted-foreground mt-1">
            Sugiere productos para dropshipping. Nós evaluamos tu solicitud.
          </p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Request Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Nueva Sugerencia
            </CardTitle>
            <CardDescription>
              Completa el formulario con los detalles del producto. Todas las sugerencias son 100% confidenciales.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Image Upload - Placeholder */}
              <div className="space-y-2">
                <Label>Imagen del producto</Label>
                <div className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/50 transition-colors">
                  <FileUp className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Arrastra una imagen o haz clic para seleccionar
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    JPEG, PNG, WEBP - Max 5MB
                  </p>
                </div>
                <Input
                  type="hidden"
                  value={formData.imageUrl}
                  onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                  placeholder="URL de la imagen (por ahora)"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="productLink">Link del producto</Label>
                <div className="relative">
                  <Input
                    id="productLink"
                    type="url"
                    placeholder="https://..."
                    value={formData.productLink}
                    onChange={(e) => setFormData({ ...formData, productLink: e.target.value })}
                    required
                  />
                  <ExternalLink className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="quantity">Cantidad mínima</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    placeholder="100"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">País</Label>
                  <Input
                    id="country"
                    placeholder="Colombia"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="modality">Modalidad</Label>
                <Select
                  value={formData.modality}
                  onValueChange={(value: "dropshipping" | "bulk" | "both") => 
                    setFormData({ ...formData, modality: value })
                  }
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

              <div className="space-y-2">
                <Label htmlFor="observations">Observaciones</Label>
                <Textarea
                  id="observations"
                  placeholder="Detalles adicionales sobre el producto, proveedor, etc."
                  value={formData.observations}
                  onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Nota:</strong> Todas las sugerencias son 100% confidenciales. 
                  Solo nós decidiremos si aceptamos la sugerencia y las cantidades.
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Enviando..." : "Enviar Sugerencia"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* My Requests */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Mis Solicitudes
            </CardTitle>
            <CardDescription>
              Historial de tus sugerencias de productos
            </CardDescription>
          </CardHeader>
          <CardContent>
            {myRequests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No has enviado ninguna sugerencia</p>
              </div>
            ) : (
              <div className="space-y-4">
                {myRequests.map((request) => (
                  <div key={request.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      {getStatusBadge(request.status)}
                      <span className="text-xs text-muted-foreground">
                        {request.createdAt?.toLocaleDateString()}
                      </span>
                    </div>
                    <div className="space-y-1 text-sm">
                      <p><strong>Cantidad:</strong> {request.quantity}</p>
                      <p><strong>País:</strong> {request.country}</p>
                      <p><strong>Modalidad:</strong> {request.modality}</p>
                      {request.productLink && (
                        <a 
                          href={request.productLink} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline flex items-center gap-1"
                        >
                          Ver producto <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                    {request.adminResponse && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-sm"><strong>Respuesta:</strong> {request.adminResponse}</p>
                        {request.approvedQuantity && (
                          <p className="text-sm text-green-600">
                            Aprobado: {request.approvedQuantity} unidades ({request.approvedModality})
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
