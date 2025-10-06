import Image from 'next/image';

export function Logo() {
  return (
    <div className="flex items-center gap-2 font-headline text-lg font-bold text-primary">
      <Image
        src="/NEGRO.png"
        alt="Logo"
        width={28}
        height={28}
        className="h-7 w-7"
      />
      <span className="text-2xl font-bold tracking-wider">ADMA</span>
    </div>
  );
}
