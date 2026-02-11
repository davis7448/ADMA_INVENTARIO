"use client";

import { useState } from 'react';
import { Task, TaskStatus } from '@/types/commercial';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KanbanBoardProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onCreateTask?: () => void;
  users?: { id: string; name: string }[];
}

const columns: { id: TaskStatus; label: string; icon: React.ReactNode; color: string }[] = [
  { 
    id: 'pending', 
    label: 'Pendientes', 
    icon: <Clock className="h-4 w-4" />,
    color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20'
  },
  { 
    id: 'in_progress', 
    label: 'En Progreso', 
    icon: <AlertCircle className="h-4 w-4" />,
    color: 'bg-blue-500/10 text-blue-600 border-blue-500/20'
  },
  { 
    id: 'completed', 
    label: 'Completadas', 
    icon: <CheckCircle2 className="h-4 w-4" />,
    color: 'bg-green-500/10 text-green-600 border-green-500/20'
  },
  { 
    id: 'rejected', 
    label: 'Rechazadas', 
    icon: <XCircle className="h-4 w-4" />,
    color: 'bg-red-500/10 text-red-600 border-red-500/20'
  },
];

const priorityColors = {
  low: 'bg-gray-500/10 text-gray-600',
  medium: 'bg-blue-500/10 text-blue-600',
  high: 'bg-red-500/10 text-red-600',
};

export function KanbanBoard({ tasks, onTaskClick, onCreateTask, users = [] }: KanbanBoardProps) {
  const [hoveredColumn, setHoveredColumn] = useState<string | null>(null);

  const getTasksByStatus = (status: TaskStatus) => 
    tasks.filter(task => task.status === status);

  const getUserName = (userId: string) => {
    const user = users.find(u => u.id === userId);
    return user?.name || userId;
  };

  return (
    <div className="space-y-4">
      {/* Header con botón crear */}
      {onCreateTask && (
        <div className="flex justify-end">
          <Button onClick={onCreateTask}>
            + Nueva Tarea
          </Button>
        </div>
      )}

      {/* Kanban Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {columns.map((column) => {
          const columnTasks = getTasksByStatus(column.id);
          const isHovered = hoveredColumn === column.id;

          return (
            <div 
              key={column.id}
              className="flex flex-col h-full"
              onMouseEnter={() => setHoveredColumn(column.id)}
              onMouseLeave={() => setHoveredColumn(null)}
            >
              {/* Column Header */}
              <div className={cn(
                "p-3 rounded-t-lg border flex items-center justify-between",
                column.color
              )}>
                <div className="flex items-center gap-2">
                  {column.icon}
                  <span className="font-semibold">{column.label}</span>
                </div>
                <Badge variant="secondary" className="bg-white/50">
                  {columnTasks.length}
                </Badge>
              </div>

              {/* Column Content */}
              <div className={cn(
                "flex-1 bg-muted/30 rounded-b-lg border border-t-0 p-3 space-y-3 min-h-[400px]",
                isHovered && "bg-muted/50"
              )}>
                {columnTasks.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-8">
                    No hay tareas
                  </p>
                ) : (
                  columnTasks.map((task) => (
                    <Card 
                      key={task.id}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => onTaskClick(task)}
                    >
                      <CardContent className="p-4 space-y-3">
                        {/* Título */}
                        <h4 className="font-medium text-sm line-clamp-2">
                          {task.title}
                        </h4>

                        {/* Info adicional */}
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>De: {getUserName(task.createdBy)}</span>
                          {task.subtasks.length > 0 && (
                            <span>
                              {task.subtasks.filter(s => s.status === 'completed').length}/{task.subtasks.length} subtareas
                            </span>
                          )}
                        </div>

                        {/* Badges */}
                        <div className="flex flex-wrap gap-2">
                          {task.priority && (
                            <span className={cn(
                              "text-xs px-2 py-0.5 rounded-full",
                              priorityColors[task.priority]
                            )}>
                              {task.priority === 'low' && 'Baja'}
                              {task.priority === 'medium' && 'Media'}
                              {task.priority === 'high' && 'Alta'}
                            </span>
                          )}
                          
                          {task.allowSubtasks && (
                            <Badge variant="outline" className="text-xs">
                              Subtareas
                            </Badge>
                          )}

                          {task.transferHistory.length > 0 && (
                            <Badge variant="outline" className="text-xs text-orange-600">
                              Transferida
                            </Badge>
                          )}
                        </div>

                        {/* Fecha límite */}
                        {task.deadline && (
                          <p className="text-xs text-muted-foreground">
                            Límite: {new Date(task.deadline.toDate()).toLocaleDateString('es-ES')}
                          </p>
                        )}

                        {/* Razón de rechazo (solo para rechazadas) */}
                        {task.status === 'rejected' && task.rejectionReason && (
                          <div className="text-xs bg-red-50 p-2 rounded text-red-700">
                            <strong>Rechazada:</strong> {task.rejectionReason}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
