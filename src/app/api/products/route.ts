import { getProducts } from '@/lib/api';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const page = Number(searchParams.get('page') || '1');
  const limit = Number(searchParams.get('limit') || '20');

  const filters = {
    searchQuery: searchParams.get('q'),
    selectedCategory: searchParams.get('category'),
    selectedRotation: searchParams.get('rotation'),
    selectedVendedor: searchParams.get('vendedor'),
    minStock: searchParams.get('minStock'),
    hasPending: searchParams.get('pending') === 'true',
    hasReservations: searchParams.get('reservations') === 'true',
    onlyAudited: searchParams.get('audited') === 'true',
    warehouseId: searchParams.get('warehouse'),
    userRole: searchParams.get('userRole'),
  };

  try {
    const result = await getProducts({ page, limit, filters });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}