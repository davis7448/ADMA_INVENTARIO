import Image from 'next/image';

export function Logo() {
  return (
    <div className="flex items-center">
      <Image
        src="/NEGRO.png"
        alt="Logo ADMA"
        width={48}
        height={48}
        className="h-12 w-12"
      />
    </div>
  );
}
