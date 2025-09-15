import { Rocket } from 'lucide-react';

export function Logo() {
  return (
    <div className="flex items-center gap-2 font-headline text-lg font-bold text-primary">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="h-7 w-7"
      >
        <title>ADMA Logo</title>
        <path d="M9.3,4.46A2.2,2.2,0,0,0,7.5,3.79,2.22,2.22,0,0,0,5.7,4.46L4.08,5.49a2.31,2.31,0,0,0-1.21,2V8.72a2.2,2.2,0,0,0,.5,1.45L4,11V21h4V11l.63-.74A2.2,2.2,0,0,0,9.1,8.72V7.47a2.31,2.31,0,0,0-1.21-2Z" fill="hsl(var(--primary))"/>
        <path d="M19.92,5.49,18.3,4.46a2.2,2.2,0,0,0-1.8-.67,2.22,2.22,0,0,0-1.8.67l-1.62,1a2.31,2.31,0,0,0-1.21,2v1.25a2.2,2.2,0,0,0,.5,1.45L13,11v5h1.25c.6,0,1.17.29,1.17.65v.9c0,.35-.57.65-1.17.65H13v2.8H11V3h2ZM20,13l-.63.74a2.2,2.2,0,0,1-3.27,0L15.47,13H15v-2h-.15l.15-.18a2.31,2.31,0,0,1,1.21-2l1.62-1a2.2,2.2,0,0,1,1.8-.67,2.22,2.22,0,0,1,1.8.67l1.62,1a2.31,2.31,0,0,1,1.21,2V13Z" fill="hsl(var(--primary))"/>
      </svg>
      <span className="text-2xl font-bold tracking-wider">ADMA</span>
    </div>
  );
}
