"use client";

// Piezas visuales del cotizador V5. Replican el prototipo del laboratorio (tarjetas con
// borde suave, chips negros al seleccionar, etiquetas en versalitas, amarillo #FFDE00)
// para que el formulario público se vea igual que lo que aprobó el equipo, sin depender
// del tema shadcn del resto de la app.
import { useRef, type ReactNode } from 'react';
import { Check, Upload, X } from 'lucide-react';

export const AMARILLO = '#FFDE00';

export function Tarjeta({ children, className = '' }: { children: ReactNode; className?: string }) {
    return (
        <div className={`rounded-[20px] bg-white border border-[#F0EDE8] shadow-[0_8px_30px_rgba(0,0,0,0.04)] ${className}`}>
            {children}
        </div>
    );
}

// Etiqueta de sección en versalitas, como "INGREDIENTES QUE QUIERES INCLUIR".
export function Rotulo({ children, className = '' }: { children: ReactNode; className?: string }) {
    return <div className={`text-[12px] font-bold tracking-widest text-black/40 ${className}`}>{children}</div>;
}

export function Titulo({ titulo, detalle }: { titulo: string; detalle: ReactNode }) {
    return (
        <div>
            <h2 className="font-headline font-bold text-[28px] leading-[1.05] tracking-tight">{titulo}</h2>
            <p className="text-[14px] text-black/50 mt-2">{detalle}</p>
        </div>
    );
}

// Tarjeta seleccionable grande (categoría, modalidad, ruta de formulación).
export function Opcion({ activa, onClick, icono, iconoAmarillo, titulo, detalle, etiqueta }: {
    activa: boolean; onClick: () => void; icono?: ReactNode; iconoAmarillo?: boolean;
    titulo: string; detalle?: string; etiqueta?: string;
}) {
    return (
        <button type="button" onClick={onClick}
            className={`rounded-[20px] bg-white border shadow-[0_8px_30px_rgba(0,0,0,0.04)] text-left p-5 md:p-6 transition-all hover:shadow-[0_12px_40px_rgba(0,0,0,0.06)] ${activa ? 'border-black shadow-[0_0_0_1px_#111,0_12px_40px_rgba(0,0,0,0.08)]' : 'border-[#F0EDE8]'}`}>
            <div className="flex justify-between items-start">
                {icono !== undefined ? (
                    <div className={`w-10 h-10 rounded-[12px] grid place-items-center text-[18px] ${iconoAmarillo && activa ? 'bg-[#FFDE00]' : 'bg-[#FAFAF8] border'}`}>{icono}</div>
                ) : <span />}
                <div className={`w-5 h-5 rounded-full border grid place-items-center ${activa ? 'bg-black border-black text-white' : 'border-black/15'}`}>
                    {activa && <Check className="w-3 h-3" />}
                </div>
            </div>
            <div className="font-headline font-bold mt-4 flex items-center gap-2">
                {titulo}
                {etiqueta && <span className="text-[10px] px-2 py-1 rounded-full bg-[#FFDE00] text-black font-bold">{etiqueta}</span>}
            </div>
            {detalle && <div className="text-[13px] text-black/50 mt-1 leading-5">{detalle}</div>}
        </button>
    );
}

// Chip redondo: negro cuando está seleccionado.
export function Chip({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: ReactNode }) {
    return (
        <button type="button" onClick={onClick}
            className={`px-4 py-2 rounded-full border text-[13px] font-medium transition ${activo ? 'bg-black text-white border-black' : 'bg-white border-black/10 hover:border-black/20'}`}>
            {children}
        </button>
    );
}

// Botón de bloque (Sí / No, formas de una sola elección).
export function Bloque({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: ReactNode }) {
    return (
        <button type="button" onClick={onClick}
            className={`p-4 rounded-[14px] border text-left text-[13px] font-semibold flex justify-between items-center ${activo ? 'bg-black text-white border-black' : 'bg-white border-black/10'}`}>
            {children}
        </button>
    );
}

export function Pildora({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: ReactNode }) {
    return (
        <button type="button" onClick={onClick}
            className={`flex-1 py-3 rounded-full border text-[13px] font-semibold ${activo ? 'bg-black text-white border-black' : 'bg-white border-black/10'}`}>
            {children}
        </button>
    );
}

export const CAMPO = 'w-full px-4 py-3 rounded-[14px] border bg-white text-[13px] outline-none focus:border-black';
export const CAMPO_REDONDO = 'w-full px-4 py-2.5 rounded-full border bg-white text-[13px] outline-none focus:border-black';
export const AREA = 'w-full p-4 rounded-[16px] border bg-white text-[13px] outline-none focus:border-black resize-none';

export function Campo({ rotulo, hijo, error, ayuda }: { rotulo: ReactNode; hijo: ReactNode; error?: string; ayuda?: ReactNode }) {
    return (
        <div>
            <Rotulo>{rotulo}</Rotulo>
            <div className="mt-3">{hijo}</div>
            {ayuda && <p className="text-[11px] text-black/40 mt-1.5">{ayuda}</p>}
            {error && <p className="text-[12px] text-red-600 mt-1.5">{error}</p>}
        </div>
    );
}

// Zona punteada para subir archivos. Muestra el nombre del fichero elegido y permite
// quitarlo; el archivo real lo guarda el padre.
export function ZonaArchivo({ rotulo, archivos, onChange, multiple, accept, alto, ayuda }: {
    rotulo: string; archivos: File[]; onChange: (f: File[]) => void;
    multiple?: boolean; accept?: string; alto?: boolean; ayuda?: string;
}) {
    const ref = useRef<HTMLInputElement>(null);
    return (
        <div>
            <div onClick={() => ref.current?.click()}
                className={`border-2 border-dashed rounded-[16px] text-center cursor-pointer bg-[#FAFAF8] hover:border-black/20 transition ${alto ? 'p-8' : 'p-6'}`}>
                <Upload className="w-5 h-5 mx-auto mb-2 text-black/40" />
                <div className="text-[13px] font-semibold">{archivos.length ? archivos.map(a => a.name).join(', ') : rotulo}</div>
                {ayuda && <div className="text-[11px] text-black/40 mt-1">{ayuda}</div>}
            </div>
            <input ref={ref} type="file" className="hidden" multiple={multiple} accept={accept}
                onChange={e => { onChange(Array.from(e.target.files || [])); e.target.value = ''; }} />
            {archivos.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                    {archivos.map(a => (
                        <span key={a.name} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#FAFAF8] border text-[12px]">
                            {a.name}
                            <button type="button" aria-label={`Quitar ${a.name}`} onClick={() => onChange(archivos.filter(x => x !== a))}><X className="w-3 h-3" /></button>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

export function CasillaTexto({ marcada, onChange, titulo, detalle, amarilla }: {
    marcada: boolean; onChange: (v: boolean) => void; titulo: ReactNode; detalle?: ReactNode; amarilla?: boolean;
}) {
    return (
        <label className={`flex gap-3 p-4 rounded-[14px] border cursor-pointer ${amarilla ? 'bg-[#FFFEF6] border-[#FFDE00]' : 'bg-[#FAFAF8]'}`}>
            <input type="checkbox" checked={marcada} onChange={e => onChange(e.target.checked)} className="w-4 h-4 mt-0.5 accent-black" />
            <div>
                <div className="text-[13px] font-semibold">{titulo}</div>
                {detalle && <div className="text-[12px] text-black/50">{detalle}</div>}
            </div>
        </label>
    );
}
