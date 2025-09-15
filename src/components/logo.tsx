import { Package } from 'lucide-react';

export function Logo() {
  return (
    <div className="flex items-center gap-2 font-headline text-lg font-semibold text-primary">
      <Package className="h-6 w-6" />
      <span>Dropstream</span>
    </div>
  );
}
