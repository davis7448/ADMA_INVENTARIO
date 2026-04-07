"use client";

import { Flame, Medal, TrendingUp } from "lucide-react";
import { MCI, UserGamificationProfile } from "@/types/commercial";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { StarDisplay } from "./star-display";
import { cn } from "@/lib/utils";

interface UserRankCardProps {
  mci: MCI;
  profile?: UserGamificationProfile;
  rank: number;
  isCurrentUser?: boolean;
  onClick?: () => void;
}

export function UserRankCard({
  mci,
  profile,
  rank,
  isCurrentUser = false,
  onClick
}: UserRankCardProps) {
  const getRankColor = () => {
    switch (rank) {
      case 1: return "from-yellow-500/20 to-yellow-600/20 border-yellow-500/50";
      case 2: return "from-gray-300/20 to-gray-400/20 border-gray-400/50";
      case 3: return "from-amber-600/20 to-amber-700/20 border-amber-600/50";
      default: return "from-muted/20 to-muted/30 border-muted/50";
    }
  };

  const getRankIcon = () => {
    switch (rank) {
      case 1: return <Medal className="w-5 h-5 text-yellow-500" />;
      case 2: return <Medal className="w-5 h-5 text-gray-400" />;
      case 3: return <Medal className="w-5 h-5 text-amber-600" />;
      default: return <span className="text-lg font-bold text-muted-foreground w-5 text-center">{rank}</span>;
    }
  };

  const isCompleted = mci.completionPercentage === 100;

  return (
    <div
      onClick={onClick}
      className={cn(
        "relative p-4 rounded-xl border-2 transition-all cursor-pointer overflow-hidden",
        "bg-gradient-to-br hover:shadow-lg",
        getRankColor(),
        isCurrentUser && "ring-2 ring-primary ring-offset-2",
        isCompleted && "border-orange-500/50"
      )}
    >
      {/* Fire effect for completed */}
      {isCompleted && (
        <div className="absolute top-2 right-2">
          <Flame className="w-5 h-5 text-orange-500 animate-pulse" />
        </div>
      )}

      <div className="flex items-center gap-4">
        {/* Rank */}
        <div className="flex-shrink-0">
          {getRankIcon()}
        </div>

        {/* Avatar */}
        <Avatar className="w-12 h-12 border-2 border-background">
          <AvatarImage src={mci.userAvatar} />
          <AvatarFallback className="bg-primary/10 text-primary font-bold">
            {mci.userName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold truncate">{mci.userName}</h4>
            {isCurrentUser && (
              <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                Tú
              </span>
            )}
          </div>
          
          <p className="text-sm text-muted-foreground truncate mb-2">
            {mci.title}
          </p>

          {/* Progress bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Progreso</span>
              <span className={cn(
                "font-medium",
                isCompleted ? "text-orange-500" : "text-foreground"
              )}>
                {mci.completionPercentage}%
              </span>
            </div>
            <Progress 
              value={mci.completionPercentage} 
              className="h-2"
            />
          </div>
        </div>

        {/* Stats */}
        <div className="flex-shrink-0 text-right">
          <StarDisplay stars={mci.starsEarned} size="sm" />
          {profile && profile.streakWeeks > 0 && (
            <div className="flex items-center justify-end gap-1 mt-1 text-xs text-orange-500">
              <TrendingUp className="w-3 h-3" />
              <span>{profile.streakWeeks} semanas</span>
            </div>
          )}
        </div>
      </div>

      {/* Level badge if profile exists */}
      {profile && (
        <div className="mt-3 pt-3 border-t border-border/50 flex justify-between items-center">
          <span className="text-xs text-muted-foreground">
            Nivel {profile.level}: {profile.levelName}
          </span>
          <span className="text-xs font-medium">
            {profile.totalPoints} pts
          </span>
        </div>
      )}
    </div>
  );
}

// Compact version for smaller lists
interface UserRankCompactProps {
  mci: MCI;
  rank: number;
  isCurrentUser?: boolean;
}

export function UserRankCompact({ mci, rank, isCurrentUser }: UserRankCompactProps) {
  return (
    <div className={cn(
      "flex items-center gap-3 p-3 rounded-lg border transition-all",
      isCurrentUser ? "bg-primary/5 border-primary/30" : "hover:bg-muted/30"
    )}>
      <span className={cn(
        "w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold",
        rank === 1 ? "bg-yellow-500 text-yellow-950" :
        rank === 2 ? "bg-gray-300 text-gray-800" :
        rank === 3 ? "bg-amber-600 text-amber-50" :
        "bg-muted text-muted-foreground"
      )}>
        {rank}
      </span>

      <Avatar className="w-8 h-8">
        <AvatarImage src={mci.userAvatar} />
        <AvatarFallback>{mci.userName.charAt(0)}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="font-medium text-sm truncate">{mci.userName}</span>
          {isCurrentUser && <span className="text-xs text-primary">(Tú)</span>}
        </div>
        <span className="text-xs text-muted-foreground">
          {mci.completionPercentage}%
        </span>
      </div>

      <StarDisplay stars={mci.starsEarned} size="sm" />
    </div>
  );
}
