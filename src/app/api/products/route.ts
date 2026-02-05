import { getProducts, updateProduct, deleteProduct, getProductById, addProduct } from '@/lib/api';
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

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    await updateProduct(id, updateData);
    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('Error updating product:', error);
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    await deleteProduct(id, null);
    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const id = await addProduct(body);
    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}