"use client";

import { useState } from "react";
import { Check, CheckCircle2, Circle, Edit2, Flame, Trash2 } from "lucide-react";
import { MCI, MDP } from "@/types/commercial";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ProgressRing } from "./progress-ring";
import { StarDisplay } from "./star-display";
import { cn } from "@/lib/utils";

interface MCICardProps {
  mci: MCI;
  isOwner: boolean;
  onToggleMDP: (mdpId: string, isCompleted: boolean) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  showControls?: boolean;
  compact?: boolean;
}

export function MCICard({
  mci,
  isOwner,
  onToggleMDP,
  onEdit,
  onDelete,
  showControls = true,
  compact = false
}: MCICardProps) {
  const [hoveredMDP, setHoveredMDP] = useState<string | null>(null);
  const isCompleted = mci.completionPercentage === 100;

  const completedCount = mci.mdps.filter(m => m.isCompleted).length;
  const totalCount = mci.mdps.length;

  return (
    <div className={cn("relative", isCompleted && "fire-animation")}>
      {/* Fire effect overlay when 100% */}
      {isCompleted && (
        <div className="absolute -inset-1 bg-gradient-to-t from-orange-500/30 via-red-500/20 to-yellow-500/30 rounded-xl blur-md animate-pulse" />
      )}
      
      <Card className={cn(
        "relative overflow-hidden transition-all duration-300",
        isCompleted 
          ? "border-orange-500/50 shadow-lg shadow-orange-500/20 bg-gradient-to-br from-orange-50/50 to-red-50/50 dark:from-orange-950/30 dark:to-red-950/30" 
          : "hover:shadow-lg"
      )}>
        {/* Fire particles effect for 100% */}
        {isCompleted && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute bottom-0 left-1/4 w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: "0s", animationDuration: "1s" }} />
            <div className="absolute bottom-0 left-1/2 w-1.5 h-1.5 bg-yellow-500 rounded-full animate-bounce" style={{ animationDelay: "0.2s", animationDuration: "1.2s" }} />
            <div className="absolute bottom-0 left-3/4 w-2 h-2 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: "0.4s", animationDuration: "0.8s" }} />
          </div>
        )}

        <CardHeader className={cn("pb-2", compact && "p-4")}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                {isCompleted && <Flame className="w-5 h-5 text-orange-500 animate-pulse" />}
                <CardTitle className={cn("text-lg", compact && "text-base")}>
                  {mci.title}
                </CardTitle>
              </div>
              {mci.description && !compact && (
                <p className="text-sm text-muted-foreground">{mci.description}</p>
              )}
            </div>
            
            {showControls && isOwner && (
              <div className="flex gap-1">
                {onEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={onEdit}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                )}
                {onDelete && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={onDelete}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className={cn("space-y-4", compact && "p-4 pt-0")}>
          {/* Progress Section */}
          <div className="flex items-center gap-4">
            <ProgressRing 
              percentage={mci.completionPercentage} 
              size={compact ? 80 : 100}
              strokeWidth={compact ? 6 : 8}
            />
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Progreso</span>
                <span className="text-sm font-medium">
                  {completedCount}/{totalCount} MDPs
                </span>
              </div>
              <StarDisplay stars={mci.starsEarned} size={compact ? "sm" : "md"} />
              {isCompleted && (
                <div className="inline-flex items-center gap-1 px-2 py-1 bg-orange-500/10 text-orange-600 rounded-full text-xs font-medium">
                  <Flame className="w-3 h-3" />
                  ¡Completado!
                </div>
              )}
            </div>
          </div>

          {/* MDPs List */}
          {!compact && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">
                Medidas de Predicción
              </h4>
              <div className="space-y-1.5">
                {mci.mdps
                  .sort((a, b) => a.order - b.order)
                  .map((mdp) => (
                    <div
                      key={mdp.id}
                      className={cn(
                        "flex items-center gap-3 p-2 rounded-lg transition-all duration-200",
                        mdp.isCompleted 
                          ? "bg-green-500/10" 
                          : "hover:bg-muted/50",
                        isOwner && "cursor-pointer"
                      )}
                      onMouseEnter={() => setHoveredMDP(mdp.id)}
                      onMouseLeave={() => setHoveredMDP(null)}
                    >
                      {isOwner ? (
                        <Checkbox
                          checked={mdp.isCompleted}
                          onCheckedChange={(checked) => 
                            onToggleMDP(mdp.id, checked as boolean)
                          }
                          className={cn(
                            "data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500",
                            hoveredMDP === mdp.id && "ring-2 ring-primary/50"
                          )}
                        />
                      ) : (
                        mdp.isCompleted ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        ) : (
                          <Circle className="w-5 h-5 text-muted-foreground" />
                        )
                      )}
                      <span className={cn(
                        "text-sm flex-1",
                        mdp.isCompleted && "line-through text-muted-foreground"
                      )}>
                        {mdp.title}
                      </span>
                      {mdp.isCompleted && (
                        <Check className="w-4 h-4 text-green-500" />
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* CSS for fire animation */}
      <style jsx>{`
        @keyframes flicker {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }
        
        .fire-animation {
          animation: flicker 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

// Compact version for lists
interface MCIListItemProps {
  mci: MCI;
  rank?: number;
  onClick?: () => void;
}

export function MCIListItem({ mci, rank, onClick }: MCIListItemProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center gap-4 p-4 rounded-lg border transition-all cursor-pointer",
        mci.completionPercentage === 100
          ? "border-orange-500/30 bg-orange-500/5 hover:border-orange-500/50"
          : "hover:bg-muted/50"
      )}
    >
      {rank && (
        <div className={cn(
          "flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm",
          rank === 1 ? "bg-yellow-500 text-yellow-950" :
          rank === 2 ? "bg-gray-300 text-gray-800" :
          rank === 3 ? "bg-amber-600 text-amber-50" :
          "bg-muted text-muted-foreground"
        )}>
          {rank}
        </div>
      )}
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {mci.completionPercentage === 100 && (
            <Flame className="w-4 h-4 text-orange-500" />
          )}
          <h4 className="font-medium truncate">{mci.title}</h4>
        </div>
        <p className="text-sm text-muted-foreground">
          {mci.userName} • Semana {mci.weekNumber}
        </p>
      </div>

      <div className="flex items-center gap-4">
        <StarDisplay stars={mci.starsEarned} size="sm" />
        <div className="text-right">
          <div className="text-lg font-bold">{mci.completionPercentage}%</div>
          <div className="text-xs text-muted-foreground">
            {mci.mdps.filter(m => m.isCompleted).length}/{mci.mdps.length}
          </div>
        </div>
      </div>
    </div>
  );
}
