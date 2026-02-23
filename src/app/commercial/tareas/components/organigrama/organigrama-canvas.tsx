"use client";

import { useState, useEffect } from 'react';
import { Area, UserPosition } from '@/types/commercial';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getAllAreas, getAllUserPositions } from '@/lib/commercial-api';
import { Briefcase, Users } from 'lucide-react';
import { AssignUserModal } from './assign-user-modal';

interface OrganigramaCanvasProps {
  onUserClick?: (userId: string) => void;
  highlightedUserId?: string;
  users?: { id: string; name: string; email?: string }[];
}

export function OrganigramaCanvas({ onUserClick, highlightedUserId, users = [] }: OrganigramaCanvasProps) {
  const [areas, setAreas] = useState<Area[]>([]);
  const [userPositions, setUserPositions] = useState<UserPosition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [areasData, positionsData] = await Promise.all([
        getAllAreas(),
        getAllUserPositions()
      ]);
      setAreas(areasData);
      setUserPositions(positionsData);
    } catch (error) {
      console.error("Error loading organigrama data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Agrupar usuarios por área
  const usersByArea = areas.map(area => ({
    area,
    users: userPositions.filter(up => up.areaId === area.id)
  }));

  // Helper para obtener nombre de usuario
  const getUserName = (userId: string) => {
    const user = users.find(u => u.id === userId);
    return user?.name || userId;
  };

  // Helper para obtener iniciales
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-8 p-6">
      {/* Header with Assign Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Organigrama</h2>
        </div>
        <AssignUserModal onSuccess={loadData} />
      </div>

      {usersByArea.map(({ area, users }) => (
        <div key={area.id} className="space-y-4">
          {/* Header del Área */}
          <div 
            className="p-4 rounded-lg text-white font-bold text-lg flex items-center gap-3"
            style={{ backgroundColor: area.color || '#3b82f6' }}
          >
            <Briefcase className="h-5 w-5" />
            {area.name}
            {area.description && (
              <span className="text-sm font-normal opacity-90 ml-2">
                {area.description}
              </span>
            )}
          </div>

          {/* Usuarios del Área */}
          {users.length === 0 ? (
            <p className="text-muted-foreground text-sm pl-4">
              No hay usuarios asignados a esta área
            </p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {users
                .sort((a, b) => a.nivel - b.nivel)
                .map((userPos) => (
                <Card 
                  key={userPos.userId}
                  className={`p-4 cursor-pointer transition-all hover:shadow-lg ${
                    highlightedUserId === userPos.userId 
                      ? 'ring-2 ring-primary shadow-lg' 
                      : ''
                  }`}
                  onClick={() => onUserClick?.(userPos.userId)}
                >
                  <div className="flex flex-col items-center text-center space-y-3">
                    <Avatar className="h-16 w-16 border-2" style={{ borderColor: area.color }}>
                      <AvatarImage src={''} />
                      <AvatarFallback className="text-lg font-bold">
                        {getInitials(getUserName(userPos.userId))}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div>
                      <p className="font-semibold text-sm">{getUserName(userPos.userId)}</p>
                      <p className="text-xs text-muted-foreground uppercase">
                        {userPos.cargo}
                      </p>
                      <span 
                        className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs text-white"
                        style={{ backgroundColor: area.color }}
                      >
                        Nivel {userPos.nivel}
                      </span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      ))}

      {areas.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No hay áreas configuradas</p>
          <p className="text-sm">Contacta al administrador para crear áreas</p>
        </div>
      )}
    </div>
  );
}
