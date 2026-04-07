import { NextRequest, NextResponse } from 'next/server';
import { collection, query, where, orderBy, limit, startAfter, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function GET(request: NextRequest) {
  console.log('[API] GET /api/history/orders - START');
  
  try {
    const { searchParams } = new URL(request.url);
    
    // Pagination params
    const cursor = searchParams.get('cursor');
    const targetPage = Number(searchParams.get('page')) || 1;
    const itemsPerPage = Number(searchParams.get('limit')) || 20;
    
    // Filter params
    const warehouseId = searchParams.get('warehouseId') || 'all';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const platformId = searchParams.get('platformId');
    const carrierId = searchParams.get('carrierId');
    const status = searchParams.get('status');
    
    console.log('[API] Orders params:', { 
      cursor, 
      targetPage, 
      itemsPerPage, 
      warehouseId,
      status
    });
    
    // Build query constraints
    const constraints: any[] = [];
    
    // Required: warehouse filter
    if (warehouseId && warehouseId !== 'all') {
      constraints.push(where('warehouseId', '==', warehouseId));
    }
    
    // Optional: platform filter
    if (platformId && platformId !== 'all') {
      constraints.push(where('platformId', '==', platformId));
    }
    
    // Optional: carrier filter
    if (carrierId && carrierId !== 'all') {
      constraints.push(where('carrierId', '==', carrierId));
    }
    
    // Optional: status filter
    if (status && status !== 'all') {
      constraints.push(where('status', '==', status));
    }
    
    // Date filters
    if (startDate) {
      constraints.push(where('date', '>=', new Date(startDate)));
    }
    if (endDate) {
      constraints.push(where('date', '<=', new Date(endDate)));
    }
    
    // Order by date desc (newest first)
    constraints.push(orderBy('date', 'desc'));
    
    // Add cursor if provided (for pagination)
    if (cursor) {
      console.log('[API] Orders fetching page after cursor:', cursor);
      try {
        const cursorDoc = await getDoc(doc(db, 'dispatchOrders', cursor));
        if (cursorDoc.exists()) {
          constraints.push(startAfter(cursorDoc));
        }
      } catch (cursorError) {
        console.error('[API] Error with cursor:', cursorError);
      }
    }
    
    // Limit results
    constraints.push(limit(itemsPerPage));
    
    // Execute query
    console.log('[API] Orders executing query with', constraints.length, 'constraints');
    const ordersRef = collection(db, 'dispatchOrders');
    const ordersQuery = query(ordersRef, ...constraints);
    
    const snapshot = await getDocs(ordersQuery);
    console.log(`[API] Orders query returned ${snapshot.docs.length} documents`);
    
    // Map results
    const orders = snapshot.docs.map(docSnapshot => {
      const data = docSnapshot.data();
      return {
        id: docSnapshot.id,
        ...data,
        date: data.date?.toDate?.() ? data.date.toDate().toISOString() : data.date,
      };
    });
    
    // Get next cursor (last document ID)
    const lastDoc = snapshot.docs[snapshot.docs.length - 1];
    const nextCursor = lastDoc?.id || null;
    
    // Check if there are more results
    const hasMore = snapshot.docs.length === itemsPerPage;
    
    console.log('[API] Orders response:', { 
      count: orders.length, 
      hasMore, 
      nextCursor,
      page: targetPage
    });
    
    return NextResponse.json({
      orders,
      hasMore,
      nextCursor,
      page: targetPage
    });
    
  } catch (error) {
    console.error('[API] Orders error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch orders', 
        details: (error as Error).message 
      },
      { status: 500 }
    );
  }
}
