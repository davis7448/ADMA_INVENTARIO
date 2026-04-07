"use client";

import { TrendingUp, Trophy, Target, Flame, Star, Zap } from "lucide-react";
import { UserGamificationProfile, DEFAULT_LEVELS } from "@/types/commercial";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface UserStatsCardProps {
  profile: UserGamificationProfile;
  className?: string;
}

export function UserStatsCard({ profile, className }: UserStatsCardProps) {
  const currentLevel = DEFAULT_LEVELS[profile.level - 1] || DEFAULT_LEVELS[0];
  const nextLevel = DEFAULT_LEVELS[profile.level] || null;
  
  // Calculate progress to next level
  const progressToNextLevel = nextLevel
    ? ((profile.totalPoints - currentLevel.minPoints) / (nextLevel.minPoints - currentLevel.minPoints)) * 100
    : 100;

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          Tu Perfil
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* User Header */}
        <div className="flex items-center gap-4">
          <Avatar className="w-16 h-16 border-4" style={{ borderColor: currentLevel.color }}>
            <AvatarImage src={profile.userAvatar} />
            <AvatarFallback className="text-2xl font-bold" style={{ backgroundColor: currentLevel.color + "20", color: currentLevel.color }}>
              {currentLevel.icon}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-bold text-lg">{profile.userName}</h3>
            <div className="flex items-center gap-2">
              <span 
                className="px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ backgroundColor: currentLevel.color + "20", color: currentLevel.color }}
              >
                Nivel {profile.level}: {currentLevel.name}
              </span>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatBox
            icon={<Star className="w-4 h-4 text-yellow-500" />}
            label="Estrellas Totales"
            value={profile.totalStars}
            color="yellow"
          />
          <StatBox
            icon={<Zap className="w-4 h-4 text-blue-500" />}
            label="Puntos Totales"
            value={profile.totalPoints}
            color="blue"
          />
          <StatBox
            icon={<Target className="w-4 h-4 text-green-500" />}
            label="Misiones Completadas"
            value={profile.missionsCompleted}
            color="green"
          />
          <StatBox
            icon={<Flame className="w-4 h-4 text-orange-500" />}
            label="Racha Semanal"
            value={`${profile.streakWeeks} sem`}
            color="orange"
            highlight={profile.streakWeeks > 0}
          />
        </div>

        {/* Level Progress */}
        {nextLevel && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progreso al siguiente nivel</span>
              <span className="font-medium">{profile.totalPoints} / {nextLevel.minPoints} pts</span>
            </div>
            <Progress value={progressToNextLevel} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">
              Siguiente: {nextLevel.name}
            </p>
          </div>
        )}

        {/* Level Badge Large */}
        <div 
          className="p-4 rounded-lg text-center"
          style={{ backgroundColor: currentLevel.color + "15" }}
        >
          <div className="text-4xl mb-2">{currentLevel.icon}</div>
          <p className="font-bold" style={{ color: currentLevel.color }}>
            {currentLevel.name}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {profile.totalPoints} puntos acumulados
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

interface StatBoxProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
  highlight?: boolean;
}

function StatBox({ icon, label, value, color, highlight }: StatBoxProps) {
  const colorClasses: Record<string, string> = {
    yellow: "bg-yellow-500/10 text-yellow-600",
    blue: "bg-blue-500/10 text-blue-600",
    green: "bg-green-500/10 text-green-600",
    orange: "bg-orange-500/10 text-orange-600",
    red: "bg-red-500/10 text-red-600",
    purple: "bg-purple-500/10 text-purple-600",
  };

  return (
    <div className={cn(
      "p-3 rounded-lg",
      colorClasses[color] || colorClasses.blue,
      highlight && "ring-2 ring-orange-500/50"
    )}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs opacity-80">{label}</span>
      </div>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}

// Weekly History Component
interface WeeklyHistoryProps {
  history: UserGamificationProfile["weeklyHistory"];
  className?: string;
}

export function WeeklyHistoryCard({ history, className }: WeeklyHistoryProps) {
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-500" />
          Historial Semanal
        </CardTitle>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No hay historial aún. ¡Comienza creando tu primera MCI!
          </p>
        ) : (
          <div className="space-y-3">
            {history.slice(0, 5).map((week, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-muted rounded-lg"
              >
                <div>
                  <p className="font-medium text-sm">
                    Semana {week.weekNumber}, {week.year}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {week.completionPercentage}% completado
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-yellow-500">
                    {week.starsEarned} ⭐
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {week.pointsEarned > 0 ? `+${week.pointsEarned}` : week.pointsEarned} pts
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
