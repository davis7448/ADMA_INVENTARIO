"use client";

import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { MCI, MDP } from "@/types/commercial";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";


interface CreateMCIModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (mci: Omit<MCI, "id" | "createdAt" | "updatedAt" | "completionPercentage" | "pointsAwarded" | "starsEarned">) => void;
  onDelete?: () => void;
  initialData?: MCI;
  userId: string;
  userName: string;
  userAvatar?: string;
  weekNumber: number;
  year: number;
}

export function CreateMCIModal({
  isOpen,
  onClose,
  onSubmit,
  onDelete,
  initialData,
  userId,
  userName,
  userAvatar,
  weekNumber,
  year,
}: CreateMCIModalProps) {
  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [mdps, setMdps] = useState<Partial<MDP>[]>(
    initialData?.mdps?.map(mdp => ({ title: mdp.title, description: mdp.description })) || [
      { title: "", description: "" },
    ]
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = !!initialData;

  const handleAddMDP = () => {
    setMdps([...mdps, { title: "", description: "" }]);
  };

  const handleRemoveMDP = (index: number) => {
    if (mdps.length > 1) {
      setMdps(mdps.filter((_, i) => i !== index));
    }
  };

  const handleMDPChange = (index: number, field: keyof MDP, value: string) => {
    const newMdps = [...mdps];
    newMdps[index] = { ...newMdps[index], [field]: value };
    setMdps(newMdps);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) return;
    
    // Filter out empty MDPs
    const validMdps = mdps
      .filter(mdp => mdp.title?.trim())
      .map((mdp, index) => ({
        id: crypto.randomUUID(),
        title: mdp.title!,
        description: mdp.description || "",
        isCompleted: false,
        order: index,
      }));

    if (validMdps.length === 0) {
      alert("Debes agregar al menos una Medida de Predicción");
      return;
    }

    setIsSubmitting(true);

    // Calculate dates (Monday to Saturday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - daysFromMonday);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 5);
    endDate.setHours(23, 59, 59, 999);

    // Build MCI data object, avoiding undefined values for Firestore
    const mciData: any = {
      userId,
      userName,
      title: title.trim(),
      weekNumber,
      year,
      startDate,
      endDate,
      mdps: validMdps,
      status: "active",
    };
    
    // Only add optional fields if they exist
    if (userAvatar) {
      mciData.userAvatar = userAvatar;
    }
    if (description.trim()) {
      mciData.description = description.trim();
    }

    await onSubmit(mciData);
    setIsSubmitting(false);
    
    if (!isEditing) {
      // Reset form for new entries
      setTitle("");
      setDescription("");
      setMdps([{ title: "", description: "" }]);
    }
    
    onClose();
  };

  const handleDelete = () => {
    if (onDelete && confirm("¿Estás seguro de que deseas eliminar esta MCI?")) {
      onDelete();
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {isEditing ? "Editar MCI" : "Crear Nueva MCI"}
          </DialogTitle>
          <DialogDescription>
            Define tu Meta Crucialmente Importante para esta semana y las Medidas de Predicción para alcanzarla.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <div className="flex-1 overflow-y-auto pr-4 max-h-[60vh]">
            <div className="space-y-6 py-4">
              {/* MCI Title */}
              <div className="space-y-2">
                <Label htmlFor="title" className="text-base">
                  Título de la MCI <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="title"
                  placeholder="Ej: Cerrar 5 ventas esta semana"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="text-lg"
                  required
                />
              </div>

              {/* MCI Description */}
              <div className="space-y-2">
                <Label htmlFor="description" className="text-base">
                  Descripción (opcional)
                </Label>
                <Textarea
                  id="description"
                  placeholder="Describe los detalles de tu meta..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Week Info */}
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Semana {weekNumber}</strong> del año {year}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Período: Lunes a Sábado
                </p>
              </div>

              {/* MDPs Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base">Medidas de Predicción (MDPs)</Label>
                  <span className="text-sm text-muted-foreground">
                    Mínimo 1 requerida
                  </span>
                </div>

                {mdps.map((mdp, index) => (
                  <div
                    key={index}
                    className="p-4 border rounded-lg space-y-3 bg-muted/30"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">
                        MDP #{index + 1}
                      </span>
                      {mdps.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleRemoveMDP(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Input
                        placeholder="Título de la MDP"
                        value={mdp.title || ""}
                        onChange={(e) =>
                          handleMDPChange(index, "title", e.target.value)
                        }
                        required={index === 0}
                      />
                      <Input
                        placeholder="Descripción opcional"
                        value={mdp.description || ""}
                        onChange={(e) =>
                          handleMDPChange(index, "description", e.target.value)
                        }
                      />
                    </div>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2"
                  onClick={handleAddMDP}
                >
                  <Plus className="h-4 w-4" />
                  Agregar otra MDP
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-4 border-t">
            {isEditing && onDelete && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Eliminar
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Guardando..." : isEditing ? "Actualizar MCI" : "Crear MCI"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
