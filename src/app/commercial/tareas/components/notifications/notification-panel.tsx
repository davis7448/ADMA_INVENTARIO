"use client";

import { TaskNotification } from "@/types/commercial";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Bell, CheckCircle2, AlertCircle, ArrowRightLeft, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";

interface NotificationPanelProps {
  notifications: TaskNotification[];
  onDismiss: (notificationId: string) => void;
  onClose: () => void;
}

const notificationIcons = {
  new_task: <Bell className="h-4 w-4 text-blue-500" />,
  task_accepted: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  task_rejected: <AlertCircle className="h-4 w-4 text-red-500" />,
  task_completed: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  task_transferred: <ArrowRightLeft className="h-4 w-4 text-orange-500" />,
  subtask_completed: <CheckCircle2 className="h-4 w-4 text-blue-500" />,
  subtask_assigned: <UserPlus className="h-4 w-4 text-purple-500" />,
};

export function NotificationPanel({ 
  notifications, 
  onDismiss, 
  onClose 
}: NotificationPanelProps) {
  return (
    <Card className="mb-6 animate-in slide-in-from-top-2">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notificaciones
          {notifications.filter(n => !n.read).length > 0 && (
            <span className="text-sm font-normal text-muted-foreground">
              ({notifications.filter(n => !n.read).length} nuevas)
            </span>
          )}
        </CardTitle>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px]">
          {notifications.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No tienes notificaciones
            </p>
          ) : (
            <div className="space-y-2">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg transition-colors",
                    notification.read 
                      ? "bg-muted/50" 
                      : "bg-primary/5 border border-primary/20"
                  )}
                >
                  <div className="mt-0.5">
                    {notificationIcons[notification.type]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {notification.taskTitle}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(notification.createdAt.toDate()).toLocaleString('es-ES', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => onDismiss(notification.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
