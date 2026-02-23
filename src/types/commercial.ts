export type ClientCategory = 'laboratorio' | 'chino';
export type ClientType = 'dropshipper' | 'mixto' | 'ecommerce';
export type ClientStatus = 'finding_winner' | 'testing' | 'selling' | 'scaling';

export interface CommercialClient {
  id?: string;
  name: string;
  email: string; // Email principal
  additional_emails?: string[]; // Correos adicionales vinculados
  phone: string;
  additional_phones?: string[]; // Teléfonos adicionales
  birthday: Date |  any; // Timestamp from Firestore often needs handling
  category: ClientCategory;
  type: ClientType;
  avg_sales: number;
  city: string;
  status: ClientStatus;
  assigned_commercial_id: string; 
  assigned_commercial_name?: string; // Nombre del comercial para mostrar
  products_testing?: string[];
  products_selling?: string[];
  notes?: string; // Notas del cliente
  history?: any[]; // Legacy field - now uses client_events collection
  last_event_number?: number; // Track event numbering for ordering
  created_at: Date | any;
  updated_at?: Date | any;
}

export type ChallengeType = 'daily' | 'monthly';

export interface CommercialChallenge {
  id?: string;
  title: string;
  description: string;
  type: ChallengeType;
  reward: string;
  is_active: boolean;
  created_by: string;
  created_at: Date | any;
}

export type RatingType = 'star' | 'angry';

export interface CommercialRating {
  id?: string;
  from_user_id: string;
  to_user_id: string;
  type: RatingType; // 'star' is +1, 'angry' is -1 or just negative sentiment
  created_at: Date | any;
}

export type ResourceType = 'video' | 'article' | 'podcast';

export interface AcademyResource {
  id?: string;
  title: string;
  description?: string;
  type: ResourceType;
  url: string; // YouTube link, article URL, etc.
  thumbnail?: string;
  created_at: Date | any;
}

// Stats interface for the Commercial Director Dashboard
export interface CommercialStats {
  userId: string;
  userName: string;
  totalClients: number;
  newClientsThisMonth: number;
  activeClients: number; // e.g. status != finding_winner ?? or specific rule
  totalBilling: number;
  starCount: number;
  angryCount: number;
}

// ============================================
// 4DX SYSTEM - MCI (Metas Crucialmente Importantes)
// ============================================

export interface MDP {
  id: string;
  title: string;
  description?: string;
  isCompleted: boolean;
  completedAt?: Date | any;
  order: number;
}

export interface MCI {
  id?: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  title: string;
  description?: string;
  weekNumber: number;
  year: number;
  startDate: Date | any;
  endDate: Date | any;
  mdps: MDP[];
  status: 'active' | 'completed' | 'failed' | 'abandoned';
  completionPercentage: number;
  pointsAwarded: number;
  starsEarned: number;
  createdAt: Date | any;
  updatedAt: Date | any;
  completedAt?: Date | any;
}

export interface WeeklyHistory {
  weekNumber: number;
  year: number;
  mciId: string;
  completionPercentage: number;
  pointsEarned: number;
  starsEarned: number;
}

export interface TaskPointsHistory {
  weekNumber: number;
  year: number;
  taskId: string;
  taskTitle: string;
  pointsEarned: number;
  completedAt: Date | any;
}

export interface UserGamificationProfile {
  userId: string;
  userName: string;
  userAvatar?: string;
  totalPoints: number;
  totalStars: number;
  level: number;
  levelName: string;
  streakWeeks: number;
  missionsCompleted: number;
  currentWeekMCI?: string;
  weeklyHistory: WeeklyHistory[];
  taskHistory: TaskPointsHistory[];
  updatedAt: Date | any;
}

export type FilterType = 'all' | 'current' | 'completed' | 'failed';
export type ViewMode = 'board' | 'list';

// Level configuration (can be edited by admin)
export interface LevelConfig {
  level: number;
  name: string;
  minPoints: number;
  maxPoints: number;
  icon: string;
  color: string;
}

// Default levels (admin editable)
export const DEFAULT_LEVELS: LevelConfig[] = [
  { level: 1, name: '🌱 Novato', minPoints: 0, maxPoints: 50, icon: '🌱', color: '#22c55e' },
  { level: 2, name: '🎮 Guerrero', minPoints: 51, maxPoints: 150, icon: '🎮', color: '#3b82f6' },
  { level: 3, name: '⚔️ Caballero', minPoints: 151, maxPoints: 300, icon: '⚔️', color: '#8b5cf6' },
  { level: 4, name: '🏆 Campeón', minPoints: 301, maxPoints: 500, icon: '🏆', color: '#f59e0b' },
  { level: 5, name: '👑 Leyenda', minPoints: 501, maxPoints: 999999, icon: '👑', color: '#ef4444' },
];

// Points calculation based on completion percentage
export const calculateStarsAndPoints = (percentage: number): { stars: number; points: number } => {
  if (percentage >= 100) return { stars: 10, points: 10 };
  if (percentage >= 90) return { stars: 9, points: 9 };
  if (percentage >= 80) return { stars: 8, points: 8 };
  if (percentage >= 70) return { stars: 7, points: 7 };
  if (percentage >= 60) return { stars: 6, points: 6 };
  if (percentage >= 50) return { stars: 5, points: 5 };
  if (percentage >= 40) return { stars: 4, points: 4 };
  if (percentage >= 30) return { stars: 3, points: 3 };
  if (percentage >= 20) return { stars: 2, points: 2 };
  if (percentage >= 10) return { stars: 1, points: 1 };
  return { stars: 0, points: -5 };
};

// Get current week number (Monday to Saturday)
export const getCurrentWeekInfo = () => {
  const now = new Date();
  const year = now.getFullYear();
  
  // Get week number
  const startOfYear = new Date(year, 0, 1);
  const pastDays = (now.getTime() - startOfYear.getTime()) / 86400000;
  const weekNumber = Math.ceil((pastDays + startOfYear.getDay() + 1) / 7);
  
  // Calculate week start (Monday) and end (Saturday)
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - daysFromMonday);
  weekStart.setHours(0, 0, 0, 0);
  
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 5); // Saturday
  weekEnd.setHours(23, 59, 59, 999);
  
  return { weekNumber, year, weekStart, weekEnd };
};

// ============================================
// TASK SYSTEM - Sistema de Tareas y Workflow
// ============================================

// Areas de trabajo (configurables por admin)
export interface Area {
  id: string;
  name: string;           // Ej: "Logística", "Comercial"
  color: string;          // Hex color para el organigrama
  description?: string;
  createdAt: Date | any;
  updatedAt: Date | any;
}

// Usuario básico (sin datos sensibles)
export interface UserBasic {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

// Posición de usuario en área (asignado por admin)
export interface UserPosition {
  id: string;
  userId: string;
  cargo: string;          // Ej: "Coordinador", "Auxiliar"
  areaId: string;         // Referencia al área
  nivel: number;          // 1, 2, 3 (para jerarquía visual)
  posicionX: number;      // Coordenada X en canvas (0-100)
  posicionY: number;      // Coordenada Y en canvas (0-100)
  updatedAt: Date | any;
}

// Subtarea interna
export interface Subtask {
  id: string;
  title: string;
  assignedTo: string;     // ID usuario
  createdBy: string;      // ID usuario que creó la subtarea
  status: 'pending' | 'in_progress' | 'completed';
  createdAt: Date | any;
  completedAt?: Date | any;
}

// Registro de transferencia
export interface TransferRecord {
  fromUserId: string;
  toUserId: string;
  reason: string;
  transferredAt: Date | any;
  transferredBy: string;  // Quién hizo la transferencia
}

// Registro de historial
export interface TaskHistoryRecord {
  action: 'created' | 'assigned' | 'accepted' | 'rejected' | 'completed' | 
          'transferred' | 'subtask_created' | 'subtask_completed' | 'priority_set';
  userId: string;
  timestamp: Date | any;
  details?: string;
}

// Tarea principal
export interface Task {
  id: string;
  title: string;
  description: string;
  createdBy: string;           // ID usuario creador
  areaId: string;              // Área destino
  assignedTo: string;          // Usuario actual responsable
  originalAssignee: string;    // Quién recibió inicialmente
  
  // Estado y Prioridad
  status: 'pending' | 'in_progress' | 'completed' | 'rejected';
  priority: 'low' | 'medium' | 'high' | null;
  
  // Fechas
  createdAt: Date | any;
  deadline?: Date | any;
  acceptedAt?: Date | any;
  completedAt?: Date | any;
  rejectedAt?: Date | any;
  
  // Rechazo
  rejectionReason?: string;
  rejectionCount: number;
  
  // Subtareas
  subtasks: Subtask[];
  allowSubtasks: boolean;
  
  // Transferencias
  transferHistory: TransferRecord[];
  
  // Historial completo
  history: TaskHistoryRecord[];
}

// Notificación de tarea (temporal)
export interface TaskNotification {
  id: string;
  userId: string;
  type: 'new_task' | 'task_accepted' | 'task_rejected' | 'task_completed' | 
        'subtask_completed' | 'task_transferred' | 'subtask_assigned';
  taskId: string;
  taskTitle: string;
  message: string;
  read: boolean;
  createdAt: Date | any;
  expiresAt: Date | any;
}

// Tracker de rechazos para penalización
export interface TaskRejectionTracker {
  userId: string;
  rejectionCount: number;
  penaltyPoints: number;
  lastRejectionDate: Date | any;
  currentPeriodStart: Date | any;
}

// Stats de tareas para dashboard admin
export interface TaskStats {
  totalTasks: number;
  completedTasks: number;
  rejectedTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  completionRate: number;
  tasksByArea: { areaId: string; areaName: string; count: number }[];
  topRejectors: { userId: string; userName: string; rejections: number }[];
  recentRejectedTasks: Task[];
}

// Tipo para filtros de tareas
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'rejected';
export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskViewMode = 'organigrama' | 'kanban' | 'my_tasks';
