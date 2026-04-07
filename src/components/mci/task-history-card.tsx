"use client";

import { CheckCircle, ListTodo } from "lucide-react";
import { UserGamificationProfile, TaskPointsHistory } from "@/types/commercial";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TaskHistoryCardProps {
  taskHistory: UserGamificationProfile["taskHistory"];
  className?: string;
}

export function TaskHistoryCard({ taskHistory, className }: TaskHistoryCardProps) {
  const sortedHistory = [...(taskHistory || [])]
    .sort((a, b) => {
      // Sort by year desc, then weekNumber desc
      if (a.year !== b.year) return b.year - a.year;
      return b.weekNumber - a.weekNumber;
    });

  // Group by week
  const groupedByWeek = sortedHistory.reduce((acc, task) => {
    const key = `${task.weekNumber}-${task.year}`;
    if (!acc[key]) {
      acc[key] = {
        weekNumber: task.weekNumber,
        year: task.year,
        tasks: [],
        totalPoints: 0
      };
    }
    acc[key].tasks.push(task);
    acc[key].totalPoints += task.pointsEarned;
    return acc;
  }, {} as Record<string, { weekNumber: number; year: number; tasks: TaskPointsHistory[]; totalPoints: number }>);

  const weeks = Object.values(groupedByWeek).sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.weekNumber - a.weekNumber;
  }).slice(0, 5);

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <ListTodo className="w-5 h-5 text-green-500" />
          Historial de Tareas
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sortedHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No hay tareas completadas aún. ¡Completa tu primera tarea para ganar puntos!
          </p>
        ) : (
          <div className="space-y-3">
            {weeks.map((week) => (
              <div
                key={`${week.weekNumber}-${week.year}`}
                className="border rounded-lg overflow-hidden"
              >
                <div className="bg-muted px-3 py-2 flex justify-between items-center">
                  <p className="font-medium text-sm">
                    Semana {week.weekNumber}, {week.year}
                  </p>
                  <p className="text-sm font-bold text-green-600">
                    +{week.totalPoints} pts
                  </p>
                </div>
                <div className="p-2 space-y-1">
                  {week.tasks.slice(0, 3).map((task, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2 text-xs py-1"
                    >
                      <CheckCircle className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="truncate">{task.taskTitle}</p>
                        <p className="text-muted-foreground">
                          +{task.pointsEarned} pts
                        </p>
                      </div>
                    </div>
                  ))}
                  {week.tasks.length > 3 && (
                    <p className="text-xs text-muted-foreground text-center">
                      +{week.tasks.length - 3} más...
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
