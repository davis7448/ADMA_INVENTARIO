import { getCategories, getWarehouses } from '@/lib/api';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const [categories, warehouses] = await Promise.all([
            getCategories(),
            getWarehouses()
        ]);

        return NextResponse.json({ categories, warehouses });
    } catch (error) {
        console.error('Error fetching catalog metadata:', error);
        return NextResponse.json(
            { error: 'Failed to fetch catalog metadata' },
            { status: 500 }
        );
    }
}