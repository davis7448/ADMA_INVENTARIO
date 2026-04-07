"use client";

import { cn } from "@/lib/utils";

interface ProgressRingProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  showPercentage?: boolean;
  color?: string;
}

export function ProgressRing({
  percentage,
  size = 120,
  strokeWidth = 8,
  className,
  showPercentage = true,
  color = "#3b82f6"
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  // Calculate color based on percentage
  const getColor = () => {
    if (percentage >= 100) return "#22c55e"; // Green
    if (percentage >= 75) return "#3b82f6"; // Blue
    if (percentage >= 50) return "#f59e0b"; // Yellow
    if (percentage >= 25) return "#f97316"; // Orange
    return "#ef4444"; // Red
  };

  const progressColor = color || getColor();

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          className="text-muted/20"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={progressColor}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
        />
      </svg>
      {showPercentage && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold" style={{ color: progressColor }}>
            {Math.round(percentage)}%
          </span>
        </div>
      )}
    </div>
  );
}
