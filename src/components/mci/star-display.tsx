"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarDisplayProps {
  stars: number;
  maxStars?: number;
  size?: "sm" | "md" | "lg";
  showNumber?: boolean;
  className?: string;
}

export function StarDisplay({
  stars,
  maxStars = 10,
  size = "md",
  showNumber = true,
  className
}: StarDisplayProps) {
  const sizeClasses = {
    sm: "w-3 h-3",
    md: "w-5 h-5",
    lg: "w-7 h-7"
  };

  const textSizes = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-lg"
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <div className="flex">
        {Array.from({ length: maxStars }).map((_, index) => (
          <Star
            key={index}
            className={cn(
              sizeClasses[size],
              "transition-all duration-300",
              index < stars
                ? "fill-yellow-400 text-yellow-400 drop-shadow-lg"
                : "fill-muted/20 text-muted/20"
            )}
          />
        ))}
      </div>
      {showNumber && (
        <span className={cn(textSizes[size], "font-bold text-yellow-500 ml-1")}>
          {stars}/{maxStars}
        </span>
      )}
    </div>
  );
}

// Compact version showing just the count
interface StarCountProps {
  stars: number;
  className?: string;
}

export function StarCount({ stars, className }: StarCountProps) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
      <span className="font-bold text-yellow-500">{stars}</span>
    </div>
  );
}
