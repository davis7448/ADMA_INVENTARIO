"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserBasic, Area } from '@/types/commercial';
import { getUnassignedUsersAction, getAreasAction, assignUserToAreaAction } from '@/app/actions/organigrama';
import { Plus, UserPlus } from 'lucide-react';

interface AssignUserModalProps {
  onSuccess?: () => void;
}

export function AssignUserModal({ onSuccess }: AssignUserModalProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unassignedUsers, setUnassignedUsers] = useState<UserBasic[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form state
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [cargo, setCargo] = useState('');
  const [nivel, setNivel] = useState('2');

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  const loadData = async () => {
    try {
      const [users, areasData] = await Promise.all([
        getUnassignedUsersAction(),
        getAreasAction(),
      ]);
      setUnassignedUsers(users);
      setAreas(areasData);
    } catch (error) {
      console.error("Error loading data:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const formData = new FormData();
    formData.append('userId', selectedUser);
    formData.append('areaId', selectedArea);
    formData.append('cargo', cargo);
    formData.append('nivel', nivel);

    try {
      const result = await assignUserToAreaAction(formData);
      
      if (result.success) {
        setMessage({ type: 'success', text: result.message });
        // Reset form
        setSelectedUser('');
        setSelectedArea('');
        setCargo('');
        setNivel('2');
        
        // Refresh data and close after delay
        setTimeout(() => {
          setOpen(false);
          setMessage(null);
          loadData();
          onSuccess?.();
        }, 1500);
      } else {
        setMessage({ type: 'error', text: result.message });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al asignar usuario' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <UserPlus className="h-4 w-4" />
          Asignar Usuario
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Asignar Usuario a Área</DialogTitle>
          <DialogDescription>
            Selecciona un usuario sin área y asígnale un área, cargo y nivel.
          </DialogDescription>
        </DialogHeader>

        {unassignedUsers.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground">
            <p>No hay usuarios sin área asignada.</p>
            <p className="text-sm mt-2">Todos los usuarios ya tienen un área asignada.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="user">Usuario</Label>
              <Select value={selectedUser} onValueChange={setSelectedUser} required>
                <SelectTrigger id="user">
                  <SelectValue placeholder="Selecciona un usuario" />
                </SelectTrigger>
                <SelectContent>
                  {unassignedUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="area">Área</Label>
              <Select value={selectedArea} onValueChange={setSelectedArea} required>
                <SelectTrigger id="area">
                  <SelectValue placeholder="Selecciona un área" />
                </SelectTrigger>
                <SelectContent>
                  {areas.map((area) => (
                    <SelectItem key={area.id} value={area.id}>
                      {area.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cargo">Cargo</Label>
              <Input
                id="cargo"
                placeholder="Ej: Coordinador, Auxiliar, Comerciante"
                value={cargo}
                onChange={(e) => setCargo(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nivel">Nivel Jerárquico</Label>
              <Select value={nivel} onValueChange={setNivel} required>
                <SelectTrigger id="nivel">
                  <SelectValue placeholder="Selecciona nivel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Nivel 1 - Gerente/Coordinador</SelectItem>
                  <SelectItem value="2">Nivel 2 - Comercial/Auxiliar</SelectItem>
                  <SelectItem value="3">Nivel 3 - Auxiliar Junior</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {message && (
              <div
                className={`p-3 rounded-md text-sm ${
                  message.type === 'success'
                    ? 'bg-green-50 text-green-700'
                    : 'bg-red-50 text-red-700'
                }`}
              >
                {message.text}
              </div>
            )}

            <DialogFooter>
              <Button type="submit" disabled={loading || !selectedUser || !selectedArea || !cargo}>
                {loading ? 'Asignando...' : 'Asignar'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
