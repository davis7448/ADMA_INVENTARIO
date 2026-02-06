import { NextRequest, NextResponse } from 'next/server';
import { collection, query, where, orderBy, limit, startAfter, getDocs, Timestamp, Query } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function POST(request: NextRequest) {
  console.log('[API] /api/history/movements - START');
  
  try {
    const body = await request.json();
    const { page = 1, limit: itemsPerPage = 20, filters = {} } = body;
    
    console.log('[API] Request params:', { page, itemsPerPage, filters });
    
    const { startDate, endDate, platformId, carrierId, warehouseId } = filters;
    
    // Base query
    let movementsQuery: Query = collection(db, 'inventoryMovements');
    
    // Build query with filters
    const constraints: any[] = [];
    
    // Warehouse filter (required for performance)
    if (warehouseId && warehouseId !== 'all') {
      constraints.push(where('warehouseId', '==', warehouseId));
    }
    
    // Date filters (most important)
    if (startDate) {
      constraints.push(where('date', '>=', new Date(startDate)));
    }
    if (endDate) {
      constraints.push(where('date', '<=', new Date(endDate)));
    }
    
    // Platform filter
    if (platformId && platformId !== 'all') {
      constraints.push(where('platformId', '==', platformId));
    }
    
    // Carrier filter
    if (carrierId && carrierId !== 'all') {
      constraints.push(where('carrierId', '==', carrierId));
    }
    
    // Order by date desc (newest first)
    constraints.push(orderBy('date', 'desc'));
    
    // Apply constraints
    movementsQuery = query(movementsQuery, ...constraints);
    
    console.log('[API] Executing query...');
    
    // Execute query
    const snapshot = await getDocs(movementsQuery);
    
    console.log(`[API] Query returned ${snapshot.docs.length} total docs`);
    
    // Map results
    let allMovements = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        date: data.date?.toDate?.() ? data.date.toDate().toISOString() : data.date,
      };
    });
    
    // Pagination (client-side for now, can be optimized with cursor)
    const totalCount = allMovements.length;
    const totalPages = Math.ceil(totalCount / itemsPerPage);
    const startIndex = (page - 1) * itemsPerPage;
    const paginatedMovements = allMovements.slice(startIndex, startIndex + itemsPerPage);
    
    console.log(`[API] Returning ${paginatedMovements.length} movements (page ${page}/${totalPages})`);
    
    return NextResponse.json({
      movements: paginatedMovements,
      totalPages,
      totalCount,
      page
    });
    
  } catch (error) {
    console.error('[API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch movements', details: (error as Error).message },
      { status: 500 }
    );
  }
}
