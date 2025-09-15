
"use client";

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getPlatforms } from '@/lib/api';
import type { Platform } from '@/lib/types';
import { AddPlatformForm } from '@/components/add-platform-form';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';

interface PlatformsContentProps {
    initialPlatforms: Platform[];
}

export function PlatformsContent({ initialPlatforms }: PlatformsContentProps) {
    const [platforms, setPlatforms] = useState<Platform[]>(initialPlatforms);
    const [loading, setLoading] = useState(false);
    const { user } = useAuth();

    const refreshPlatforms = async () => {
        setLoading(true);
        const fetchedPlatforms = await getPlatforms();
        setPlatforms(fetchedPlatforms);
        setLoading(false);
    }
    
    const canEdit = user?.role === 'admin';

    return (
        <div className="space-y-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold font-headline tracking-tight">Platforms</h1>
              <p className="text-muted-foreground">Manage your sales platforms.</p>
            </div>
            {canEdit && <AddPlatformForm onPlatformAdded={refreshPlatforms} />}
          </div>
          <Card>
            <CardHeader>
              <CardTitle>All Platforms</CardTitle>
              <CardDescription>A list of all available sales platforms.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                     Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i}>
                            <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                        </TableRow>
                     ))
                  ) : (
                    platforms.map((platform) => (
                        <TableRow key={platform.id}>
                            <TableCell className="font-medium">{platform.name}</TableCell>
                        </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
    )
}
