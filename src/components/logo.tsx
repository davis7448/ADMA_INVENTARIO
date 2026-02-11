import Image from 'next/image';

export function Logo() {
  return (
    <div className="flex items-center">
      <Image
        src="/NEGRO.png"
        alt="Logo ADMA"
        width={64}
        height={64}
        className="h-16 w-16"
      />
    </div>
  );
}
