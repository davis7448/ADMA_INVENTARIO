"use client";

import { useState, useEffect } from 'react';
import { Area, UserPosition } from '@/types/commercial';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  getAllAreas, 
  createArea, 
  updateArea, 
  deleteArea,
  getAllUserPositions,
  setUserPosition
} from '@/lib/commercial-api';
import { Plus, Pencil, Trash2, Building2, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AreaManagementProps {
  users: { id: string; name: string; email: string }[];
}

export function AreaManagement({ users }: AreaManagementProps) {
  const { toast } = useToast();
  const [areas, setAreas] = useState<Area[]>([]);
  const [userPositions, setUserPositions] = useState<UserPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<Area | null>(null);
  const [areaName, setAreaName] = useState('');
  const [areaColor, setAreaColor] = useState('#3b82f6');
  const [areaDescription, setAreaDescription] = useState('');
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [userCargo, setUserCargo] = useState('');
  const [userNivel, setUserNivel] = useState(1);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [areasData, positionsData] = await Promise.all([
        getAllAreas(),
        getAllUserPositions()
      ]);
      setAreas(areasData);
      setUserPositions(positionsData);
    } catch (error) {
      console.error("Error loading data:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveArea = async () => {
    if (!areaName.trim()) return;

    try {
      if (editingArea) {
        await updateArea(editingArea.id, {
          name: areaName,
          color: areaColor,
          description: areaDescription
        });
        toast({ title: "Área actualizada" });
      } else {
        await createArea({
          name: areaName,
          color: areaColor,
          description: areaDescription
        });
        toast({ title: "Área creada" });
      }
      
      setIsModalOpen(false);
      setEditingArea(null);
      setAreaName('');
      setAreaColor('#3b82f6');
      setAreaDescription('');
      await loadData();
    } catch (error) {
      console.error("Error saving area:", error);
      toast({
        title: "Error",
        description: "No se pudo guardar el área",
        variant: "destructive",
      });
    }
  };

  const handleDeleteArea = async (areaId: string) => {
    if (!confirm("¿Estás seguro de eliminar esta área? Los usuarios asignados perderán su asignación.")) return;

    try {
      await deleteArea(areaId);
      toast({ title: "Área eliminada" });
      await loadData();
    } catch (error) {
      console.error("Error deleting area:", error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el área",
        variant: "destructive",
      });
    }
  };

  const handleAssignUser = async () => {
    if (!selectedUser || !selectedArea || !userCargo.trim()) return;

    try {
      await setUserPosition(selectedUser, {
        cargo: userCargo,
        areaId: selectedArea,
        nivel: userNivel,
        posicionX: 50,
        posicionY: 50
      });
      
      toast({ title: "Usuario asignado al área" });
      setIsUserModalOpen(false);
      setSelectedUser('');
      setSelectedArea('');
      setUserCargo('');
      setUserNivel(1);
      await loadData();
    } catch (error) {
      console.error("Error assigning user:", error);
      toast({
        title: "Error",
        description: "No se pudo asignar el usuario",
        variant: "destructive",
      });
    }
  };

  const getUsersInArea = (areaId: string) => {
    return userPositions.filter(up => up.areaId === areaId);
  };

  const getUserName = (userId: string) => {
    const user = users.find(u => u.id === userId);
    return user?.name || userId;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Building2 className="h-6 w-6" />
          Gestión de Áreas
        </h2>
        <div className="flex gap-3">
          <Button onClick={() => setIsUserModalOpen(true)} variant="outline">
            <Users className="h-4 w-4 mr-2" />
            Asignar Usuario
          </Button>
          <Button onClick={() => {
            setEditingArea(null);
            setAreaName('');
            setAreaColor('#3b82f6');
            setAreaDescription('');
            setIsModalOpen(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Área
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {areas.map((area) => (
          <Card key={area.id}>
            <CardHeader 
              className="text-white"
              style={{ backgroundColor: area.color }}
            >
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg">{area.name}</CardTitle>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-white hover:bg-white/20"
                    onClick={() => {
                      setEditingArea(area);
                      setAreaName(area.name);
                      setAreaColor(area.color);
                      setAreaDescription(area.description || '');
                      setIsModalOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-white hover:bg-white/20"
                    onClick={() => handleDeleteArea(area.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {area.description && (
                <p className="text-sm text-white/80">{area.description}</p>
              )}
            </CardHeader>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground mb-3">
                {getUsersInArea(area.id).length} usuarios asignados
              </p>
              <div className="space-y-1">
                {getUsersInArea(area.id).map((up) => (
                  <div key={up.userId} className="text-sm flex justify-between">
                    <span>{getUserName(up.userId)}</span>
                    <span className="text-muted-foreground">{up.cargo}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}

        {areas.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No hay áreas configuradas</p>
            <p className="text-sm">Crea tu primera área para comenzar</p>
          </div>
        )}
      </div>

      {/* Modal Crear/Editar Área */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingArea ? 'Editar Área' : 'Nueva Área'}
            </DialogTitle>
            <DialogDescription>
              Configura el nombre, color y descripción del área
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre del área</Label>
              <Input
                value={areaName}
                onChange={(e) => setAreaName(e.target.value)}
                placeholder="Ej: Logística"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={areaColor}
                  onChange={(e) => setAreaColor(e.target.value)}
                  className="h-10 w-20 rounded cursor-pointer"
                />
                <span className="text-sm text-muted-foreground">{areaColor}</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Descripción (opcional)</Label>
              <Input
                value={areaDescription}
                onChange={(e) => setAreaDescription(e.target.value)}
                placeholder="Descripción del área..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveArea} disabled={!areaName.trim()}>
              {editingArea ? 'Guardar Cambios' : 'Crear Área'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Asignar Usuario */}
      <Dialog open={isUserModalOpen} onOpenChange={setIsUserModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Asignar Usuario a Área</DialogTitle>
            <DialogDescription>
              Asigna un usuario a un área con su cargo correspondiente
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Usuario</Label>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="w-full p-2 border rounded-md"
              >
                <option value="">Selecciona un usuario</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.email})
                  </option>
                ))}
              </select>
            </div>
            
            <div className="space-y-2">
              <Label>Área</Label>
              <select
                value={selectedArea}
                onChange={(e) => setSelectedArea(e.target.value)}
                className="w-full p-2 border rounded-md"
              >
                <option value="">Selecciona un área</option>
                {areas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="space-y-2">
              <Label>Cargo</Label>
              <Input
                value={userCargo}
                onChange={(e) => setUserCargo(e.target.value)}
                placeholder="Ej: Coordinador, Auxiliar, Director"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Nivel Jerárquico</Label>
              <select
                value={userNivel}
                onChange={(e) => setUserNivel(parseInt(e.target.value))}
                className="w-full p-2 border rounded-md"
              >
                <option value={1}>Nivel 1 (Base)</option>
                <option value={2}>Nivel 2 (Medio)</option>
                <option value={3}>Nivel 3 (Alto)</option>
                <option value={4}>Nivel 4 (Directivo)</option>
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUserModalOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleAssignUser} 
              disabled={!selectedUser || !selectedArea || !userCargo.trim()}
            >
              Asignar Usuario
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
