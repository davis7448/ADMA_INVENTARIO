"use strict";

import { cn } from "@/lib/utils";
import { Trophy, Calendar, CheckCircle2 } from "lucide-react";
import { CommercialChallenge } from "@/types/commercial";

interface ChallengeCardProps {
    challenge: CommercialChallenge;
    onComplete?: (id: string) => void;
}

export function ChallengeCard({ challenge, onComplete }: ChallengeCardProps) {
    const isDaily = challenge.type === 'daily';

    return (
        <div className={cn(
            "relative overflow-hidden rounded-xl border p-6 transition-all hover:shadow-lg hover:-translate-y-1",
            // Glassmorphism effect
            "bg-white/40 dark:bg-black/40 backdrop-blur-md border-white/20 shadow-xl",
            isDaily ? "from-blue-500/10 to-purple-500/10 bg-gradient-to-br" : "from-amber-500/10 to-orange-500/10 bg-gradient-to-br"
        )}>
            <div className="flex justify-between items-start mb-4">
                <div className="p-2 rounded-full bg-background/50 backdrop-blur-sm">
                    {isDaily ? <Calendar className="h-6 w-6 text-blue-500" /> : <Trophy className="h-6 w-6 text-amber-500" />}
                </div>
                <span className={cn(
                    "px-2 py-1 text-xs font-semibold rounded-full border",
                    isDaily ? "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300" : "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300"
                )}>
                    {isDaily ? "RETO DEL DÍA" : "RETO MENSUAL"}
                </span>
            </div>

            <h3 className="text-xl font-bold mb-2 text-foreground">{challenge.title}</h3>
            <p className="text-muted-foreground mb-6 text-sm leading-relaxed">
                {challenge.description}
            </p>

            <div className="flex items-center justify-between">
                <div className="flex flex-col">
                    <span className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">Premio</span>
                    <span className="font-bold text-primary">{challenge.reward}</span>
                </div>

                {/* Action Button (e.g. Mark as done, or View details) */}
                <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity shadow-md">
                    Ver detalles
                </button>
            </div>
        </div>
    );
}
