"use client";

import { useEffect, useState } from "react";
import { Plus, Trophy, Filter, Target } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

import { MCI, UserGamificationProfile, getCurrentWeekInfo, FilterType } from "@/types/commercial";
import {
  getUserMCIForWeek,
  getAllMCIsForWeek,
  getUserGamificationProfile,
  createMCI,
  updateMCI,
  deleteMCI,
  toggleMDP,
  createUserGamificationProfile,
} from "@/lib/commercial-api";

import { MCICard } from "@/components/mci/mci-card";
import { UserRankCard } from "@/components/mci/user-rank-card";
import { UserStatsCard, WeeklyHistoryCard } from "@/components/mci/user-stats-card";
import { TaskHistoryCard } from "@/components/mci/task-history-card";
import { CreateMCIModal } from "@/components/mci/create-mci-modal";
import { StarDisplay } from "@/components/mci/star-display";

export default function ChallengesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { weekNumber, year } = getCurrentWeekInfo();

  // Data states
  const [loading, setLoading] = useState(true);
  const [userMCI, setUserMCI] = useState<MCI | null>(null);
  const [allMCIs, setAllMCIs] = useState<MCI[]>([]);
  const [userProfile, setUserProfile] = useState<UserGamificationProfile | null>(null);
  
  // UI states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMCI, setEditingMCI] = useState<MCI | undefined>(undefined);
  const [filter, setFilter] = useState<FilterType>("all");

  // Load data on mount
  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      
      // Load user profile or create if doesn't exist
      let profile = await getUserGamificationProfile(user.id);
      if (!profile) {
        await createUserGamificationProfile(
          user.id, 
          user.name || "Usuario", 
          user.avatarUrl || null
        );
        profile = await getUserGamificationProfile(user.id);
      }
      setUserProfile(profile);

      // Load user's MCI for current week
      const mci = await getUserMCIForWeek(user.id, weekNumber, year);
      setUserMCI(mci);

      // Load all MCIs for leaderboard
      const mcis = await getAllMCIsForWeek(weekNumber, year);
      setAllMCIs(mcis);
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

  // Handle MCI creation
  const handleCreateMCI = async (mciData: Omit<MCI, "id" | "createdAt" | "updatedAt" | "completionPercentage" | "pointsAwarded" | "starsEarned">) => {
    if (!user?.id) {
      toast({
        title: "Error",
        description: "Debes iniciar sesión para crear una MCI",
        variant: "destructive",
      });
      return;
    }
    
    try {
      // Remove undefined values
      const cleanData = {
        ...mciData,
        userAvatar: mciData.userAvatar || null,
      };
      await createMCI(cleanData);
      await loadData();
      toast({
        title: "¡MCI Creada!",
        description: "Tu Meta Crucialmente Importante ha sido creada exitosamente.",
      });
    } catch (error) {
      console.error("Error creating MCI:", error);
      toast({
        title: "Error",
        description: "No se pudo crear la MCI",
        variant: "destructive",
      });
    }
  };

  // Handle MCI update
  const handleUpdateMCI = async (mciData: Omit<MCI, "id" | "createdAt" | "updatedAt" | "completionPercentage" | "pointsAwarded" | "starsEarned">) => {
    if (!editingMCI?.id) return;
    
    try {
      await updateMCI(editingMCI.id, mciData);
      await loadData();
      setEditingMCI(undefined);
      toast({
        title: "¡MCI Actualizada!",
        description: "Los cambios han sido guardados.",
      });
    } catch (error) {
      console.error("Error updating MCI:", error);
      toast({
        title: "Error",
        description: "No se pudo actualizar la MCI",
        variant: "destructive",
      });
    }
  };

  // Handle MCI deletion
  const handleDeleteMCI = async () => {
    if (!userMCI?.id) return;
    
    try {
      await deleteMCI(userMCI.id);
      setUserMCI(null);
      await loadData();
      toast({
        title: "MCI Eliminada",
        description: "La MCI ha sido eliminada exitosamente.",
      });
    } catch (error) {
      console.error("Error deleting MCI:", error);
      toast({
        title: "Error",
        description: "No se pudo eliminar la MCI",
        variant: "destructive",
      });
    }
  };

  // Handle MDP toggle
  const handleToggleMDP = async (mdpId: string, isCompleted: boolean) => {
    if (!userMCI?.id) return;
    
    try {
      await toggleMDP(userMCI.id, mdpId, isCompleted);
      await loadData();
      
      if (isCompleted) {
        toast({
          title: "¡MDP Completada!",
          description: "¡Sigue así!",
        });
      }
      
      // Check if 100% completed
      const updatedMCI = await getUserMCIForWeek(user?.id || "", weekNumber, year);
      if (updatedMCI?.completionPercentage === 100) {
        toast({
          title: "🎉 ¡MCI COMPLETADA AL 100%!",
          description: `¡Felicidades! Has ganado ${updatedMCI.starsEarned} estrellas y ${updatedMCI.pointsAwarded} puntos!`,
        });
      }
    } catch (error) {
      console.error("Error toggling MDP:", error);
      toast({
        title: "Error",
        description: "No se pudo actualizar la MDP",
        variant: "destructive",
      });
    }
  };

  // Filter MCIs
  const filteredMCIs = allMCIs.filter((mci) => {
    switch (filter) {
      case "completed":
        return mci.completionPercentage === 100;
      case "active":
        return mci.completionPercentage > 0 && mci.completionPercentage < 100;
      case "failed":
        return mci.completionPercentage === 0;
      default:
        return true;
    }
  });

  // Sort by completion percentage (descending)
  const sortedMCIs = [...filteredMCIs].sort(
    (a, b) => b.completionPercentage - a.completionPercentage
  );

  if (loading) {
    return <ChallengesPageSkeleton />;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Trophy className="w-8 h-8 text-yellow-500" />
            Misiones Semanales
          </h1>
          <p className="text-muted-foreground">
            Basado en Las 4 Disciplinas de la Ejecución • Semana {weekNumber}, {year}
          </p>
        </div>
        
        {!userMCI && (
          <Button onClick={() => setIsModalOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Crear MCI
          </Button>
        )}
      </div>

      {/* Main Content - 3 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column - Your MCI (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="w-5 h-5 text-orange-500" />
                Tu MCI de esta Semana
              </CardTitle>
            </CardHeader>
            <CardContent>
              {userMCI ? (
                <MCICard
                  mci={userMCI}
                  isOwner={true}
                  onToggleMDP={handleToggleMDP}
                  onEdit={() => {
                    setEditingMCI(userMCI);
                    setIsModalOpen(true);
                  }}
                  onDelete={handleDeleteMCI}
                />
              ) : (
                <div className="text-center py-8 space-y-4">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto">
                    <Target className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">No tienes una MCI esta semana</p>
                    <p className="text-sm text-muted-foreground">
                      Crea tu Meta Crucialmente Importante para comenzar
                    </p>
                  </div>
                  <Button onClick={() => setIsModalOpen(true)} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Crear MCI
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* User Stats */}
          {userProfile && <UserStatsCard profile={userProfile} />}
          
          {/* Weekly History */}
          {userProfile && (
            <WeeklyHistoryCard history={userProfile.weeklyHistory} />
          )}
          
          {/* Task History */}
          {userProfile && (
            <TaskHistoryCard taskHistory={userProfile.taskHistory} />
          )}
        </div>

        {/* Center Column - Leaderboard (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="h-full">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                  Tablero de Resultados
                </CardTitle>
                <Select value={filter} onValueChange={(v) => setFilter(v as FilterType)}>
                  <SelectTrigger className="w-[140px]">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="completed">Completadas</SelectItem>
                    <SelectItem value="active">En Progreso</SelectItem>
                    <SelectItem value="failed">Sin Iniciar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-3">
                  {sortedMCIs.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No hay misiones para mostrar
                    </p>
                  ) : (
                    sortedMCIs.map((mci, index) => (
                      <UserRankCard
                        key={mci.id}
                        mci={mci}
                        profile={mci.userId === user?.id ? userProfile || undefined : undefined}
                        rank={index + 1}
                        isCurrentUser={mci.userId === user?.id}
                      />
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Info & Stats (3 cols) */}
        <div className="lg:col-span-3 space-y-6">
          {/* How it works */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">¿Cómo funciona?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3 text-sm">
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-xs font-bold">
                    1
                  </div>
                  <p className="text-muted-foreground">
                    <strong>Crea tu MCI:</strong> Define tu meta crucial para la semana
                  </p>
                </div>
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-xs font-bold">
                    2
                  </div>
                  <p className="text-muted-foreground">
                    <strong>Agrega MDPs:</strong> Medidas de Predicción para alcanzar tu meta
                  </p>
                </div>
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-xs font-bold">
                    3
                  </div>
                  <p className="text-muted-foreground">
                    <strong>Cumple las MDPs:</strong> Marca cada tarea completada
                  </p>
                </div>
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-xs font-bold">
                    4
                  </div>
                  <p className="text-muted-foreground">
                    <strong>Gana puntos:</strong> Completa al 100% para máximas recompensas
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Points System */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <StarDisplay stars={10} size="sm" showNumber={false} />
                Sistema de Puntos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center p-2 bg-green-500/10 rounded">
                  <span>100% Completado</span>
                  <span className="font-bold text-green-600">10 ⭐ +10 pts</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-blue-500/10 rounded">
                  <span>80-99% Completado</span>
                  <span className="font-bold text-blue-600">8-9 ⭐ +8-9 pts</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-yellow-500/10 rounded">
                  <span>50-79% Completado</span>
                  <span className="font-bold text-yellow-600">5-7 ⭐ +5-7 pts</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-red-500/10 rounded">
                  <span>&lt; 10% Completado</span>
                  <span className="font-bold text-red-600">0 ⭐ -5 pts</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Levels Info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Niveles</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 p-2 bg-green-500/10 rounded">
                  <span>🌱</span>
                  <span className="flex-1">Novato</span>
                  <span className="text-muted-foreground">0-50 pts</span>
                </div>
                <div className="flex items-center gap-2 p-2 bg-blue-500/10 rounded">
                  <span>🎮</span>
                  <span className="flex-1">Guerrero</span>
                  <span className="text-muted-foreground">51-150 pts</span>
                </div>
                <div className="flex items-center gap-2 p-2 bg-purple-500/10 rounded">
                  <span>⚔️</span>
                  <span className="flex-1">Caballero</span>
                  <span className="text-muted-foreground">151-300 pts</span>
                </div>
                <div className="flex items-center gap-2 p-2 bg-yellow-500/10 rounded">
                  <span>🏆</span>
                  <span className="flex-1">Campeón</span>
                  <span className="text-muted-foreground">301-500 pts</span>
                </div>
                <div className="flex items-center gap-2 p-2 bg-red-500/10 rounded">
                  <span>👑</span>
                  <span className="flex-1">Leyenda</span>
                  <span className="text-muted-foreground">500+ pts</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal */}
      <CreateMCIModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingMCI(undefined);
        }}
        onSubmit={editingMCI ? handleUpdateMCI : handleCreateMCI}
        onDelete={editingMCI ? handleDeleteMCI : undefined}
        initialData={editingMCI}
        userId={user?.id || ""}
        userName={user?.name || "Usuario"}
        userAvatar={user?.avatarUrl || undefined}
        weekNumber={weekNumber}
        year={year}
      />
    </div>
  );
}

// Loading skeleton
function ChallengesPageSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48 mt-2" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-6">
          <Skeleton className="h-[400px]" />
          <Skeleton className="h-[300px]" />
        </div>
        <div className="lg:col-span-5">
          <Skeleton className="h-[600px]" />
        </div>
        <div className="lg:col-span-3 space-y-6">
          <Skeleton className="h-[200px]" />
          <Skeleton className="h-[250px]" />
          <Skeleton className="h-[200px]" />
        </div>
      </div>
    </div>
  );
}
