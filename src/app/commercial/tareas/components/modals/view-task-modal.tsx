"use client";

import { useState } from 'react';
import { Task, TaskPriority } from '@/types/commercial';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  CheckCircle2, 
  XCircle, 
  ArrowRightLeft, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  User
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ViewTaskModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  onAccept: (taskId: string, priority: TaskPriority) => void;
  onReject: (taskId: string, reason: string) => void;
  onTransfer: (taskId: string, toUserId: string, reason: string) => void;
  onComplete: (taskId: string) => void;
  availableUsers: { id: string; name: string }[];
  rejectionCount?: number;
  users?: { id: string; name: string }[];
}

const priorityOptions = [
  { value: 'low', label: 'Baja', color: 'bg-gray-500' },
  { value: 'medium', label: 'Media', color: 'bg-blue-500' },
  { value: 'high', label: 'Alta', color: 'bg-red-500' },
];

export function ViewTaskModal({
  task,
  isOpen,
  onClose,
  currentUserId,
  onAccept,
  onReject,
  onTransfer,
  onComplete,
  availableUsers,
  rejectionCount = 0,
  users = [],
}: ViewTaskModalProps) {
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedPriority, setSelectedPriority] = useState<TaskPriority>('medium');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!task) return null;

  const getUserName = (userId: string) => {
    const user = users.find(u => u.id === userId);
    return user?.name || userId;
  };

  const isAssignedToMe = task.assignedTo === currentUserId;
  const isCreator = task.createdBy === currentUserId;
  const canAct = isAssignedToMe && task.status === 'pending';
  const canComplete = isAssignedToMe && task.status === 'in_progress';

  const handleAccept = async () => {
    setIsSubmitting(true);
    await onAccept(task.id, selectedPriority);
    setIsSubmitting(false);
    onClose();
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    setIsSubmitting(true);
    await onReject(task.id, rejectReason.trim());
    setIsSubmitting(false);
    setShowRejectForm(false);
    setRejectReason('');
    onClose();
  };

  const handleTransfer = async () => {
    if (!selectedUser || !transferReason.trim()) return;
    setIsSubmitting(true);
    await onTransfer(task.id, selectedUser, transferReason.trim());
    setIsSubmitting(false);
    setShowTransferForm(false);
    setSelectedUser('');
    setTransferReason('');
    onClose();
  };

  const handleComplete = async () => {
    setIsSubmitting(true);
    await onComplete(task.id);
    setIsSubmitting(false);
    onClose();
  };

  // Contador de rechazos restantes sin penalización
  const remainingFreeRejections = Math.max(0, 3 - rejectionCount);
  const willPenaltyApply = rejectionCount >= 3;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {task.status === 'pending' && <Clock className="h-6 w-6 text-yellow-500" />}
            {task.status === 'in_progress' && <AlertTriangle className="h-6 w-6 text-blue-500" />}
            {task.status === 'completed' && <CheckCircle className="h-6 w-6 text-green-500" />}
            {task.status === 'rejected' && <XCircle className="h-6 w-6 text-red-500" />}
            <DialogTitle>
              {task.status === 'pending' && 'Revisar Tarea Asignada'}
              {task.status === 'in_progress' && 'Tarea en Progreso'}
              {task.status === 'completed' && 'Tarea Completada'}
              {task.status === 'rejected' && 'Tarea Rechazada'}
            </DialogTitle>
          </div>
          <DialogDescription>
            Creada el {new Date(task.createdAt.toDate()).toLocaleDateString('es-ES')}
            {task.deadline && ` • Límite: ${new Date(task.deadline.toDate()).toLocaleDateString('es-ES')}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Info de la tarea */}
          <div className="bg-muted p-4 rounded-lg space-y-3">
            <h3 className="font-semibold text-lg">{task.title}</h3>
            {task.description && (
              <p className="text-muted-foreground">{task.description}</p>
            )}
            
            <div className="flex flex-wrap gap-2 pt-2">
              <Badge variant="outline">De: {getUserName(task.createdBy)}</Badge>
              {task.priority && (
                <Badge className={cn(
                  task.priority === 'low' && 'bg-gray-500',
                  task.priority === 'medium' && 'bg-blue-500',
                  task.priority === 'high' && 'bg-red-500'
                )}>
                  Prioridad: {task.priority === 'low' ? 'Baja' : task.priority === 'medium' ? 'Media' : 'Alta'}
                </Badge>
              )}
              {task.allowSubtasks && (
                <Badge variant="secondary">Subtareas permitidas</Badge>
              )}
            </div>
          </div>

          {/* Si está pendiente y me está asignada */}
          {canAct && !showRejectForm && !showTransferForm && (
            <div className="space-y-4">
              {/* Selección de prioridad */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">🎯 Asignar Prioridad</Label>
                <RadioGroup 
                  value={selectedPriority} 
                  onValueChange={(v) => setSelectedPriority(v as TaskPriority)}
                  className="flex gap-4"
                >
                  {priorityOptions.map((option) => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <RadioGroupItem value={option.value} id={option.value} />
                      <Label htmlFor={option.value} className="flex items-center gap-2 cursor-pointer">
                        <div className={cn("w-3 h-3 rounded-full", option.color)} />
                        {option.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              {/* Botones de acción */}
              <div className="flex flex-col gap-3">
                <Button 
                  onClick={handleAccept} 
                  disabled={isSubmitting}
                  className="w-full"
                  size="lg"
                >
                  <CheckCircle2 className="mr-2 h-5 w-5" />
                  Aceptar Tarea
                </Button>

                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowTransferForm(true)}
                    disabled={isSubmitting}
                    className="flex-1"
                  >
                    <ArrowRightLeft className="mr-2 h-4 w-4" />
                    Transferir
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={() => setShowRejectForm(true)}
                    disabled={isSubmitting}
                    className="flex-1"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Rechazar
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Formulario de rechazo */}
          {showRejectForm && (
            <div className="space-y-4 border-l-4 border-red-500 pl-4">
              <div className="bg-red-50 p-3 rounded text-sm text-red-800">
                <AlertTriangle className="inline h-4 w-4 mr-1" />
                {remainingFreeRejections > 0 ? (
                  <>
                    Te quedan {remainingFreeRejections} rechazos sin penalización este período.
                  </>
                ) : (
                  <>
                    <strong>¡Atención!</strong> Este rechazo te restará <strong>3 puntos</strong> de tu puntuación.
                  </>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="rejectReason">¿Por qué rechazas esta tarea? *</Label>
                <Textarea
                  id="rejectReason"
                  placeholder="Explica la razón del rechazo..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  required
                />
              </div>

              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowRejectForm(false);
                    setRejectReason('');
                  }}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={handleReject}
                  disabled={!rejectReason.trim() || isSubmitting}
                  className="flex-1"
                >
                  {isSubmitting ? 'Procesando...' : 'Confirmar Rechazo'}
                </Button>
              </div>
            </div>
          )}

          {/* Formulario de transferencia */}
          {showTransferForm && (
            <div className="space-y-4 border-l-4 border-blue-500 pl-4">
              <div className="space-y-2">
                <Label>Transferir a:</Label>
                <select
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  className="w-full p-2 border rounded-md"
                >
                  <option value="">Selecciona un usuario</option>
                  {availableUsers
                    .filter(u => u.id !== currentUserId)
                    .map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="transferReason">Motivo de la transferencia *</Label>
                <Textarea
                  id="transferReason"
                  placeholder="¿Por qué no puedes realizar esta tarea?"
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  required
                />
              </div>

              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowTransferForm(false);
                    setSelectedUser('');
                    setTransferReason('');
                  }}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={handleTransfer}
                  disabled={!selectedUser || !transferReason.trim() || isSubmitting}
                  className="flex-1"
                >
                  {isSubmitting ? 'Transfiriendo...' : 'Transferir Tarea'}
                </Button>
              </div>
            </div>
          )}

          {/* Si está en progreso y me está asignada - botón completar */}
          {canComplete && (
            <Button 
              onClick={handleComplete}
              disabled={isSubmitting}
              className="w-full"
              size="lg"
              variant="default"
            >
              <CheckCircle2 className="mr-2 h-5 w-5" />
              Marcar como Completada
            </Button>
          )}

          {/* Si está rechazada, mostrar razón */}
          {task.status === 'rejected' && task.rejectionReason && (
            <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
              <h4 className="font-semibold text-red-800 flex items-center gap-2">
                <XCircle className="h-4 w-4" />
                Tarea Rechazada
              </h4>
              <p className="text-red-700 mt-2">{task.rejectionReason}</p>
              <p className="text-red-600 text-sm mt-1">
                Rechazada el {task.rejectedAt && new Date(task.rejectedAt.toDate()).toLocaleDateString('es-ES')}
              </p>
            </div>
          )}

          {/* Historial de transferencias */}
          {task.transferHistory.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Historial de Transferencias</h4>
              <div className="space-y-2">
                {task.transferHistory.map((transfer, idx) => (
                  <div key={idx} className="text-sm bg-muted p-2 rounded flex items-center gap-2">
                    <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                    <span>Transferida de {getUserName(transfer.fromUserId)} a {getUserName(transfer.toUserId)}</span>
                    <span className="text-muted-foreground text-xs">
                      {new Date(transfer.transferredAt.toDate()).toLocaleDateString('es-ES')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
