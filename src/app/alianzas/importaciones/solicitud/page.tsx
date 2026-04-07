"use client";

import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { createImportRequestAction } from '../../../actions/import-requests';
import { useRouter } from 'next/navigation';
import { Upload, X } from 'lucide-react';

export default function ImportRequestForm() {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    productName: '',
    referenceLink: '',
  });

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsLoading(true);
    try {
      // Create FormData for server action (exactly like the working product form)
      const formDataToSend = new FormData();
      formDataToSend.append('productName', formData.productName);
      formDataToSend.append('userId', user.id);
      formDataToSend.append('userName', user.name);

      // Handle image exactly like the product form
      if (selectedImage) {
        formDataToSend.append('image', selectedImage);
      }

      if (formData.referenceLink && formData.referenceLink.trim()) {
        formDataToSend.append('referenceLink', formData.referenceLink.trim());
      }

      console.log('Sending FormData to server action');

      const result = await createImportRequestAction(formDataToSend);

      console.log('Server action result:', result);

      if (result.success) {
        toast({
          title: "Solicitud creada",
          description: "La solicitud de importación ha sido creada exitosamente.",
        });
        router.push('/alianzas/importaciones/registro');
      } else {
        throw new Error(result.error || 'Error desconocido');
      }
    } catch (error) {
      console.error('Error creating import request:', error);
      toast({
        title: "Error",
        description: `No se pudo crear la solicitud de importación: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Solicitud de Importación</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="productName">Nombre del Producto *</Label>
              <Input
                id="productName"
                name="productName"
                value={formData.productName}
                onChange={handleChange}
                required
                placeholder="Ingrese el nombre del producto a solicitar"
              />
            </div>

            <div className="space-y-2">
              <Label>Imagen del Producto</Label>
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-4">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                    id="image-upload"
                  />
                  <Label
                    htmlFor="image-upload"
                    className="flex items-center gap-2 px-4 py-2 border border-dashed border-gray-300 rounded-md cursor-pointer hover:border-gray-400 transition-colors"
                  >
                    <Upload className="h-4 w-4" />
                    Seleccionar imagen
                  </Label>
                  {imagePreview && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={removeImage}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {imagePreview && (
                  <div className="relative">
                    <img
                      src={imagePreview}
                      alt="Vista previa"
                      className="w-32 h-32 object-cover rounded-md border"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="referenceLink">Link de Referencia (Alibaba/AliExpress)</Label>
              <Input
                id="referenceLink"
                name="referenceLink"
                type="url"
                value={formData.referenceLink}
                onChange={handleChange}
                placeholder="https://es.aliexpress.com/item/..."
              />
            </div>

            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? 'Creando solicitud...' : 'Crear Solicitud'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
