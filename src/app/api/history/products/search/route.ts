import { NextRequest, NextResponse } from 'next/server';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function GET(request: NextRequest) {
  console.log('[API] /api/history/products/search - START');
  
  try {
    const searchParams = request.nextUrl.searchParams;
    const searchQuery = searchParams.get('q') || '';
    const warehouseId = searchParams.get('warehouseId') || 'all';
    
    console.log('[API] Search params:', { searchQuery, warehouseId });
    
    if (!searchQuery || searchQuery.length < 3) {
      return NextResponse.json(
        { error: 'Search query must be at least 3 characters' },
        { status: 400 }
      );
    }
    
    const productsRef = collection(db, 'products');
    const searchLower = searchQuery.toLowerCase();
    
    // Simple search by name (start with, for better performance)
    // Note: Firestore doesn't support partial text search natively
    // For production, consider Algolia or similar
    let productsQuery = query(
      productsRef,
      orderBy('name'),
      limit(20)
    );
    
    console.log('[API] Executing product search...');
    
    const snapshot = await getDocs(productsQuery);
    
    // Filter results client-side for partial matches
    let products = snapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      .filter((product: any) => {
        const nameMatch = product.name?.toLowerCase().includes(searchLower);
        const skuMatch = product.sku?.toLowerCase().includes(searchLower);
        const warehouseMatch = warehouseId === 'all' || product.warehouseId === warehouseId;
        return (nameMatch || skuMatch) && warehouseMatch;
      })
      .slice(0, 20);
    
    console.log(`[API] Found ${products.length} products`);
    
    return NextResponse.json({ products });
    
  } catch (error) {
    console.error('[API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to search products', details: (error as Error).message },
      { status: 500 }
    );
  }
}
