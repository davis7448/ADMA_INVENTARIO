import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format as formatInTimeZone } from 'date-fns-tz';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const COLOMBIA_TIME_ZONE = 'America/Bogota';

export function formatToTimeZone(
  date: string | Date,
  formatString: string,
  options?: any
): string {
  return formatInTimeZone(date, formatString, { 
    timeZone: COLOMBIA_TIME_ZONE,
    ...options
  });
}
