

"use client";

import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback } from 'react';
import type { Warehouse } from '@/lib/types';
import { getWarehouses } from '@/lib/api';

const WAREHOUSE_STORAGE_KEY = 'adma-current-warehouse-id';

interface WarehouseContextType {
  warehouses: Warehouse[];
  currentWarehouse: Warehouse | null;
  setWarehouse: (warehouseId: string) => void;
  loading: boolean;
}

const WarehouseContext = createContext<WarehouseContextType | null>(null);

export function WarehouseProvider({ children }: { children: ReactNode }) {
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [currentWarehouse, setCurrentWarehouse] = useState<Warehouse | null>(null);
    const [loading, setLoading] = useState(true);
  
    useEffect(() => {
        const fetchAndSetWarehouses = async () => {
          try {
            const fetchedWarehouses = await getWarehouses();
            setWarehouses(fetchedWarehouses);
          } catch (error) {
            console.error("Failed to fetch warehouses:", error);
          } finally {
            setLoading(false);
          }
        };
        fetchAndSetWarehouses();
    }, []);

    const setWarehouse = useCallback((warehouseId: string) => {
        // This is handled by the header now which navigates, this is for local state if needed
    }, []);
  
    const value = { warehouses, currentWarehouse, setWarehouse, loading };

    return (
      <WarehouseContext.Provider value={value}>
        {children}
      </WarehouseContext.Provider>
    );
  }
  
  export function useWarehouse(warehouseIdFromUrl: string | null) {
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [currentWarehouse, setCurrentWarehouse] = useState<Warehouse | null>(null);
    const [loading, setLoading] = useState(true);
  
    useEffect(() => {
      const fetchAndSetWarehouses = async () => {
        try {
          const fetchedWarehouses = await getWarehouses();
          setWarehouses(fetchedWarehouses);
          
          const targetId = warehouseIdFromUrl;

          if (targetId && targetId !== 'all') {
            const found = fetchedWarehouses.find(wh => wh.id === targetId);
            setCurrentWarehouse(found || null);
          } else {
            setCurrentWarehouse(null); // 'all' warehouses
          }
        } catch (error) {
          console.error("Failed to fetch warehouses:", error);
        } finally {
          setLoading(false);
        }
      };
      fetchAndSetWarehouses();
    }, [warehouseIdFromUrl]);
  
    const setWarehouse = useCallback((warehouseId: string) => {
        // This is now handled by URL navigation in the header
    }, []);
  
    return { warehouses, currentWarehouse, setWarehouse, loading };
  }
