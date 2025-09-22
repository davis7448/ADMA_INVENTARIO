
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

        const storedWarehouseId = localStorage.getItem(WAREHOUSE_STORAGE_KEY);
        if (storedWarehouseId && storedWarehouseId !== 'all') {
          const found = fetchedWarehouses.find(wh => wh.id === storedWarehouseId);
          setCurrentWarehouse(found || null);
        }
      } catch (error) {
        console.error("Failed to fetch warehouses:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchAndSetWarehouses();
  }, []);

  const setWarehouse = useCallback((warehouseId: string) => {
    if (warehouseId === 'all') {
        localStorage.removeItem(WAREHOUSE_STORAGE_KEY);
        setCurrentWarehouse(null);
    } else {
        const warehouseToSet = warehouses.find(wh => wh.id === warehouseId);
        if (warehouseToSet) {
            localStorage.setItem(WAREHOUSE_STORAGE_KEY, warehouseId);
            setCurrentWarehouse(warehouseToSet);
        }
    }
  }, [warehouses]);

  const value = { warehouses, currentWarehouse, setWarehouse, loading };

  return (
    <WarehouseContext.Provider value={value}>
      {children}
    </WarehouseContext.Provider>
  );
}

export function useWarehouse() {
  const context = useContext(WarehouseContext);
  if (!context) {
    throw new Error('useWarehouse debe ser usado dentro de un WarehouseProvider');
  }
  return context;
}
