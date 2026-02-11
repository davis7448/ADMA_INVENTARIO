"use client";

import { useState } from 'react';
import { Area } from '@/types/commercial';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (taskData: {
    title: string;
    description: string;
    areaId: string;
    assignedTo: string;
    deadline?: Date;
    allowSubtasks: boolean;
  }) => void;
  areas: Area[];
  users: { id: string; name: string; areaId?: string }[];
}

export function CreateTaskModal({
  isOpen,
  onClose,
  onSubmit,
  areas,
  users,
}: CreateTaskModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [deadline, setDeadline] = useState<Date | undefined>(undefined);
  const [allowSubtasks, setAllowSubtasks] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !selectedArea || !assignedTo) return;

    setIsSubmitting(true);
    await onSubmit({
      title: title.trim(),
      description: description.trim(),
      areaId: selectedArea,
      assignedTo,
      deadline,
      allowSubtasks,
    });
    setIsSubmitting(false);
    
    // Reset form
    setTitle('');
    setDescription('');
    setSelectedArea('');
    setAssignedTo('');
    setDeadline(undefined);
    setAllowSubtasks(false);
    onClose();
  };

  // Filtrar usuarios por área seleccionada
  const filteredUsers = selectedArea 
    ? users.filter(u => u.areaId === selectedArea)
    : users;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>✏️ Nueva Tarea</DialogTitle>
          <DialogDescription>
            Crea una nueva tarea y asígnala a un miembro del equipo
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Título */}
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              placeholder="Ej: Preparar reporte mensual"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          {/* Descripción */}
          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              placeholder="Describe los detalles de la tarea..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {/* Área */}
          <div className="space-y-2">
            <Label>Área *</Label>
            <Select value={selectedArea} onValueChange={setSelectedArea}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un área" />
              </SelectTrigger>
              <SelectContent>
                {areas.map((area) => (
                  <SelectItem key={area.id} value={area.id}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: area.color }}
                      />
                      {area.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Asignar a */}
          <div className="space-y-2">
            <Label>Asignar a *</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo} disabled={!selectedArea}>
              <SelectTrigger>
                <SelectValue placeholder={selectedArea ? "Selecciona una persona" : "Primero selecciona un área"} />
              </SelectTrigger>
              <SelectContent>
                {filteredUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Fecha límite */}
          <div className="space-y-2">
            <Label>Fecha límite (opcional)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !deadline && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {deadline ? format(deadline, 'PPP', { locale: es }) : "Seleccionar fecha"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={deadline}
                  onSelect={setDeadline}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Permitir subtareas */}
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="subtasks" 
              checked={allowSubtasks}
              onCheckedChange={(checked) => setAllowSubtasks(checked as boolean)}
            />
            <Label htmlFor="subtasks" className="text-sm font-normal">
              Permitir crear subtareas
            </Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting || !title.trim() || !selectedArea || !assignedTo}>
              {isSubmitting ? 'Creando...' : 'Crear Tarea'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
