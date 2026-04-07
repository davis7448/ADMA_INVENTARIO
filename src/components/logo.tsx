import Image from 'next/image';

export function Logo() {
  return (
    <div className="flex items-center">
      <Image
        src="/NEGRO.png"
        alt="Logo ADMA"
        width={128}
        height={128}
        className="h-32 w-32"
      />
    </div>
  );
}
