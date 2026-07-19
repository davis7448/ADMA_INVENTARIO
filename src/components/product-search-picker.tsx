"use client";

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Input } from '@/components/ui/input';
import { Loader2, Search } from 'lucide-react';
import type { Product } from '@/lib/types';

export type ProductPick = {
    id: string;
    name: string;
    sku?: string;
    imageUrl?: string;
    stock?: number;
    contentLink?: string;
    priceDropshipping?: number;
    productType?: 'simple' | 'variable';
    variants?: Product['variants'];
    categoryId?: string;
};

// Buscador de productos por nombre o SKU con desplegable y vista previa.
// Reusa el endpoint /api/history/products/search (mínimo 3 caracteres).
export function ProductSearchPicker({ onSelect, placeholder }: {
    onSelect: (product: ProductPick) => void;
    placeholder?: string;
}) {
    const [term, setTerm] = useState('');
    const [results, setResults] = useState<ProductPick[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout>>();

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleChange = (value: string) => {
        setTerm(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (value.trim().length < 3) {
            setResults([]);
            setIsOpen(false);
            return;
        }
        debounceRef.current = setTimeout(async () => {
            setIsLoading(true);
            try {
                const response = await fetch(`/api/history/products/search?q=${encodeURIComponent(value.trim())}`);
                const data = await response.json();
                setResults((data.products || []).map((p: any) => ({
                    id: p.id, name: p.name, sku: p.sku, imageUrl: p.imageUrl, stock: p.stock,
                    contentLink: p.contentLink, priceDropshipping: p.priceDropshipping,
                    productType: p.productType, variants: p.variants, categoryId: p.categoryId,
                })));
                setIsOpen(true);
            } catch {
                setResults([]);
            } finally {
                setIsLoading(false);
            }
        }, 350);
    };

    const handleSelect = (product: ProductPick) => {
        onSelect(product);
        setTerm(product.name);
        setIsOpen(false);
    };

    return (
        <div ref={containerRef} className="relative">
            <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    value={term}
                    onChange={e => handleChange(e.target.value)}
                    onFocus={() => results.length > 0 && setIsOpen(true)}
                    placeholder={placeholder || 'Busca por nombre o SKU (mín. 3 letras)…'}
                    className="pl-8"
                />
                {isLoading && <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            {isOpen && (
                <div className="absolute z-50 mt-1 w-full max-h-72 overflow-y-auto rounded-md border bg-popover shadow-md">
                    {results.length > 0 ? results.map(product => (
                        <button
                            key={product.id}
                            type="button"
                            className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/60"
                            onClick={() => handleSelect(product)}
                        >
                            {product.imageUrl ? (
                                <Image src={product.imageUrl} alt={product.name} width={36} height={36} className="rounded object-cover aspect-square shrink-0" />
                            ) : (
                                <div className="w-9 h-9 rounded bg-muted shrink-0" />
                            )}
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate">{product.name}</p>
                                <p className="text-xs text-muted-foreground truncate">
                                    {product.sku ? `SKU: ${product.sku}` : 'Sin SKU'}
                                    {product.stock !== undefined ? ` · Stock: ${product.stock}` : ''}
                                    {product.productType === 'variable' ? ` · ${product.variants?.length || 0} variantes` : ''}
                                </p>
                            </div>
                        </button>
                    )) : (
                        <p className="px-3 py-3 text-sm text-muted-foreground">Sin resultados — verifica el nombre o SKU.</p>
                    )}
                </div>
            )}
        </div>
    );
}
