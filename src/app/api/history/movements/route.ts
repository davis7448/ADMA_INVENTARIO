import { NextRequest, NextResponse } from 'next/server';
import { collection, query, where, orderBy, limit, startAfter, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function GET(request: NextRequest) {
  console.log('[API] GET /api/history/movements - START');
  
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
    
    console.log('[API] Params:', { 
      cursor, 
      targetPage, 
      itemsPerPage, 
      warehouseId,
      hasDateFilter: !!(startDate || endDate)
    });
    
    // Build query constraints
    const constraints: any[] = [];
    
    // Required: warehouse filter
    if (warehouseId && warehouseId !== 'all') {
      constraints.push(where('warehouseId', '==', warehouseId));
    }
    
    // Optional: platform filter (before orderBy for index efficiency)
    if (platformId && platformId !== 'all') {
      constraints.push(where('platformId', '==', platformId));
    }
    
    // Optional: carrier filter (before orderBy for index efficiency)
    if (carrierId && carrierId !== 'all') {
      constraints.push(where('carrierId', '==', carrierId));
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
      console.log('[API] Fetching page after cursor:', cursor);
      try {
        const cursorDoc = await getDoc(doc(db, 'inventoryMovements', cursor));
        if (cursorDoc.exists()) {
          constraints.push(startAfter(cursorDoc));
        }
      } catch (cursorError) {
        console.error('[API] Error with cursor:', cursorError);
        // Continue without cursor
      }
    }
    
    // Limit results
    constraints.push(limit(itemsPerPage));
    
    // Execute query
    console.log('[API] Executing query with', constraints.length, 'constraints');
    const movementsRef = collection(db, 'inventoryMovements');
    const movementsQuery = query(movementsRef, ...constraints);
    
    const snapshot = await getDocs(movementsQuery);
    console.log(`[API] Query returned ${snapshot.docs.length} documents`);
    
    // Map results
    const movements = snapshot.docs.map(docSnapshot => {
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
    
    console.log('[API] Response:', { 
      count: movements.length, 
      hasMore, 
      nextCursor,
      page: targetPage
    });
    
    return NextResponse.json({
      movements,
      hasMore,
      nextCursor,
      page: targetPage
    });
    
  } catch (error) {
    console.error('[API] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch movements', 
        details: (error as Error).message 
      },
      { status: 500 }
    );
  }
}
