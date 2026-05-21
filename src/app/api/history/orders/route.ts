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
    const productId = searchParams.get('productId');
    const userId = searchParams.get('userId');
    
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

    if (userId && userId !== 'all') {
      constraints.push(where('createdBy.id', '==', userId));
    }

    // Date filters
    if (startDate) {
      constraints.push(where('date', '>=', new Date(startDate)));
    }
    if (endDate) {
      const endDateObj = new Date(endDate);
      endDateObj.setHours(23, 59, 59, 999);
      constraints.push(where('date', '<=', endDateObj));
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
    
    // When filtering by product we need to fetch more and filter client-side
    // (Firestore can't filter on nested array of objects)
    const fetchLimit = productId ? itemsPerPage * 20 : itemsPerPage;
    constraints.push(limit(fetchLimit));

    // Execute query
    console.log('[API] Orders executing query with', constraints.length, 'constraints');
    const ordersRef = collection(db, 'dispatchOrders');
    const ordersQuery = query(ordersRef, ...constraints);

    const snapshot = await getDocs(ordersQuery);
    console.log(`[API] Orders query returned ${snapshot.docs.length} documents`);

    // Map results
    let orders = snapshot.docs.map(docSnapshot => {
      const data = docSnapshot.data();
      return {
        id: docSnapshot.id,
        ...data,
        date: data.date?.toDate?.() ? data.date.toDate().toISOString() : data.date,
      };
    });

    // Client-side product filter (Firestore limitation with nested arrays)
    if (productId) {
      orders = orders.filter((o: any) =>
        Array.isArray(o.products) && o.products.some((p: any) => p.productId === productId)
      );
    }

    // Paginate after client-side filter
    const pageOffset = productId ? (targetPage - 1) * itemsPerPage : 0;
    const pagedOrders = productId ? orders.slice(pageOffset, pageOffset + itemsPerPage) : orders;

    // Get next cursor (last document ID from Firestore snapshot, not paged slice)
    const lastDoc = snapshot.docs[snapshot.docs.length - 1];
    const nextCursor = lastDoc?.id || null;

    const hasMore = productId
      ? orders.length > pageOffset + itemsPerPage
      : snapshot.docs.length === itemsPerPage;
    
    console.log('[API] Orders response:', { 
      count: orders.length, 
      hasMore, 
      nextCursor,
      page: targetPage
    });
    
    return NextResponse.json({
      orders: pagedOrders,
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
