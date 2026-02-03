"use strict";

import { Star, Smile, Frown } from 'lucide-react';
import { cn } from '@/lib/utils';
import React from 'react';

interface StarRatingProps {
    rating: number; // Current rating count (stars)
    angryCount?: number;
    onRate?: (type: 'star' | 'angry') => void;
    readOnly?: boolean;
    size?: 'sm' | 'md' | 'lg';
}

export function StarRating({ rating, angryCount = 0, onRate, readOnly = false, size = 'md' }: StarRatingProps) {

    const sizeClasses = {
        sm: 'h-4 w-4',
        md: 'h-6 w-6',
        lg: 'h-8 w-8'
    };

    return (
        <div className="flex items-center gap-4">
            {/* Positive Ratings */}
            <div className="flex items-center gap-1 group">
                <button
                    disabled={readOnly}
                    onClick={() => onRate && onRate('star')}
                    className={cn(
                        "transition-transform active:scale-90 focus:outline-none",
                        !readOnly && "hover:scale-110 cursor-pointer"
                    )}
                >
                    <Star className={cn(sizeClasses[size], "fill-yellow-400 text-yellow-400")} />
                </button>
                <span className="font-bold text-yellow-500">{rating}</span>
            </div>

            {/* Negative Ratings (if relevant) */}
            <div className="flex items-center gap-1 group">
                <button
                    disabled={readOnly}
                    onClick={() => onRate && onRate('angry')}
                    className={cn(
                        "transition-transform active:scale-90 focus:outline-none",
                        !readOnly && "hover:scale-110 cursor-pointer"
                    )}
                >
                    <Frown className={cn(sizeClasses[size], "text-red-500")} />
                </button>
                <span className="font-bold text-red-500">{angryCount}</span>
            </div>
        </div>
    );
}
