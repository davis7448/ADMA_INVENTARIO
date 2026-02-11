"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Task, Area, UserPosition, TaskPriority } from "@/types/commercial";
import {
  getAllTasks,
  getTasksByAssignee,
  createTask,
  acceptTask,
  rejectTask,
  transferTask,
  completeTask,
  getAllAreas,
  getAllUserPositions,
  getRejectionTracker,
} from "@/lib/commercial-api";
import { useTaskNotifications } from "./hooks/use-task-notifications";
import { OrganigramaCanvas } from "./components/organigrama/organigrama-canvas";
import { KanbanBoard } from "./components/kanban/kanban-board";
import { CreateTaskModal } from "./components/modals/create-task-modal";
import { ViewTaskModal } from "./components/modals/view-task-modal";
import { NotificationPanel } from "./components/notifications/notification-panel";
import { 
  Briefcase, 
  LayoutDashboard, 
  User, 
  Bell,
  Network,
  Columns,
  Settings
} from "lucide-react";
import { User as UserType } from "@/lib/types";
import { getUsers } from "@/lib/api";
import { AreaManagement } from "@/components/admin/area-management";

export default function TareasPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { notifications, unreadCount, dismissNotification } = useTaskNotifications(user?.id || null);
  
  // Data states
  const [tasks, setTasks] = useState<Task[]>([]);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [userPositions, setUserPositions] = useState<UserPosition[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [rejectionCount, setRejectionCount] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // UI states
  const [activeTab, setActiveTab] = useState("organigrama");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      
      // Cargar todas las tareas, áreas, posiciones y usuarios
      const [allTasks, myTasksData, areasData, positionsData, usersData] = await Promise.all([
        getAllTasks(),
        getTasksByAssignee(user.id),
        getAllAreas(),
        getAllUserPositions(),
        getUsers(),
      ]);
      
      setTasks(allTasks);
      setMyTasks(myTasksData);
      setAreas(areasData);
      setUserPositions(positionsData);
      setUsers(usersData);
      
      // Cargar contador de rechazos
      const tracker = await getRejectionTracker(user.id);
      setRejectionCount(tracker?.rejectionCount || 0);
      
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

  const handleCreateTask = async (taskData: {
    title: string;
    description: string;
    areaId: string;
    assignedTo: string;
    deadline?: Date;
    allowSubtasks: boolean;
  }) => {
    if (!user?.id) return;
    
    try {
      await createTask({
        ...taskData,
        createdBy: user.id,
        assignedTo: taskData.assignedTo,
        originalAssignee: taskData.assignedTo,
        areaId: taskData.areaId,
      });
      
      toast({
        title: "Tarea creada",
        description: "La tarea ha sido asignada exitosamente",
      });
      
      await loadData();
    } catch (error) {
      console.error("Error creating task:", error);
      toast({
        title: "Error",
        description: "No se pudo crear la tarea",
        variant: "destructive",
      });
    }
  };

  const handleAcceptTask = async (taskId: string, priority: TaskPriority) => {
    if (!user?.id) return;
    
    try {
      await acceptTask(taskId, user.id, priority);
      toast({
        title: "Tarea aceptada",
        description: `Has aceptado la tarea con prioridad ${priority}`,
      });
      await loadData();
    } catch (error) {
      console.error("Error accepting task:", error);
      toast({
        title: "Error",
        description: "No se pudo aceptar la tarea",
        variant: "destructive",
      });
    }
  };

  const handleRejectTask = async (taskId: string, reason: string) => {
    if (!user?.id) return;
    
    try {
      const result = await rejectTask(taskId, user.id, reason);
      
      if (result.penaltyApplied) {
        toast({
          title: "Tarea rechazada",
          description: `Has rechazado la tarea. Se te han restado ${result.pointsDeducted} puntos.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Tarea rechazada",
          description: "Has rechazado la tarea sin penalización",
        });
      }
      
      await loadData();
    } catch (error) {
      console.error("Error rejecting task:", error);
      toast({
        title: "Error",
        description: "No se pudo rechazar la tarea",
        variant: "destructive",
      });
    }
  };

  const handleTransferTask = async (taskId: string, toUserId: string, reason: string) => {
    if (!user?.id) return;
    
    try {
      await transferTask(taskId, user.id, toUserId, reason);
      toast({
        title: "Tarea transferida",
        description: "La tarea ha sido transferida exitosamente",
      });
      await loadData();
    } catch (error) {
      console.error("Error transferring task:", error);
      toast({
        title: "Error",
        description: "No se pudo transferir la tarea",
        variant: "destructive",
      });
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    if (!user?.id) return;
    
    try {
      const pointsEarned = await completeTask(taskId, user.id);
      toast({
        title: "Tarea completada",
        description: `¡Excelente trabajo! Has ganado ${pointsEarned} puntos`,
      });
      await loadData();
    } catch (error) {
      console.error("Error completing task:", error);
      toast({
        title: "Error",
        description: "No se pudo completar la tarea",
        variant: "destructive",
      });
    }
  };

  // Preparar lista de usuarios para el modal
  const usersForModal = userPositions.map(up => {
    const area = areas.find(a => a.id === up.areaId);
    const user = users.find(u => u.id === up.userId);
    return {
      id: up.userId,
      name: user?.name || up.userId,
      areaId: up.areaId,
      cargo: up.cargo,
      areaName: area?.name || 'Sin área'
    };
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Briefcase className="h-8 w-8 text-primary" />
            Tareas y Workflow
          </h1>
          <p className="text-muted-foreground">
            Gestiona tareas, flujos de trabajo y colaboración entre áreas
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Botón Admin (solo para admins) */}
          {user?.role === 'admin' && (
            <Button 
              variant="outline" 
              onClick={() => setShowAdmin(!showAdmin)}
              className={showAdmin ? "bg-primary/10" : ""}
            >
              <Settings className="h-4 w-4 mr-2" />
              {showAdmin ? 'Ver Tareas' : 'Administrar Áreas'}
            </Button>
          )}
          
          {/* Botón Notificaciones */}
          <Button 
            variant="outline" 
            className="relative"
            onClick={() => setShowNotifications(!showNotifications)}
          >
            <Bell className="h-4 w-4 mr-2" />
            Notificaciones
            {unreadCount > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
              >
                {unreadCount}
              </Badge>
            )}
          </Button>
          
          {/* Botón Crear Tarea (solo si no está en vista admin) */}
          {!showAdmin && (
            <Button onClick={() => setIsCreateModalOpen(true)}>
              + Nueva Tarea
            </Button>
          )}
        </div>
      </div>

      {/* Panel de Notificaciones */}
      {showNotifications && (
        <NotificationPanel 
          notifications={notifications}
          onDismiss={dismissNotification}
          onClose={() => setShowNotifications(false)}
        />
      )}

      {/* Vista Admin: Gestión de Áreas */}
      {showAdmin && user?.role === 'admin' ? (
        <AreaManagement users={users} />
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="organigrama" className="flex items-center gap-2">
              <Network className="h-4 w-4" />
              Organigrama
            </TabsTrigger>
            <TabsTrigger value="kanban" className="flex items-center gap-2">
              <Columns className="h-4 w-4" />
              Kanban
            </TabsTrigger>
            <TabsTrigger value="mis-tareas" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Mis Tareas
              {myTasks.filter(t => t.status === 'pending').length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {myTasks.filter(t => t.status === 'pending').length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

        <TabsContent value="organigrama" className="mt-6">
          <OrganigramaCanvas 
            users={users}
            onUserClick={(userId) => {
              console.log("Usuario seleccionado:", userId);
            }}
          />
        </TabsContent>

        <TabsContent value="kanban" className="mt-6">
          <KanbanBoard 
            tasks={tasks}
            users={users}
            onTaskClick={(task) => setSelectedTask(task)}
            onCreateTask={() => setIsCreateModalOpen(true)}
          />
        </TabsContent>

        <TabsContent value="mis-tareas" className="mt-6">
          <KanbanBoard 
            tasks={myTasks}
            users={users}
            onTaskClick={(task) => setSelectedTask(task)}
          />
        </TabsContent>
        </Tabs>
      )}

      {/* Modal Crear Tarea */}
      <CreateTaskModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateTask}
        areas={areas}
        users={usersForModal}
      />

      {/* Modal Ver Tarea */}
      <ViewTaskModal
        task={selectedTask}
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        currentUserId={user?.id || ''}
        onAccept={handleAcceptTask}
        onReject={handleRejectTask}
        onTransfer={handleTransferTask}
        onComplete={handleCompleteTask}
        availableUsers={usersForModal}
        rejectionCount={rejectionCount}
        users={users}
      />
    </div>
  );
}
