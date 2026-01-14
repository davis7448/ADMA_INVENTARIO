"use client";

import { useState, useTransition } from 'react';
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
import { Button } from '@/components/ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import type { User } from '@/lib/types';
import { updateUserSalaryAction } from '@/app/actions/users';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from './ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';

interface SalaryManagementProps {
    comerciales: User[];
    loading: boolean;
    onUsersUpdate: () => void;
}

export function SalaryManagement({ comerciales, loading, onUsersUpdate }: SalaryManagementProps) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const handleEdit = (user: User) => {
        setEditingId(user.id);
        setEditValue(user.salary?.toString() || '');
    };

    const handleSave = (userId: string) => {
        const salary = parseFloat(editValue);
        if (isNaN(salary) || salary < 0) {
            toast({ title: 'Error', description: 'Por favor, ingresa un salario válido.', variant: 'destructive' });
            return;
        }

        startTransition(async () => {
            const result = await updateUserSalaryAction(userId, salary);
            if (result.success) {
                toast({ title: '¡Éxito!', description: result.message });
                setEditingId(null);
                onUsersUpdate();
            } else {
                toast({ title: 'Error', description: result.message, variant: 'destructive' });
            }
        });
    };

    const handleCancel = () => {
        setEditingId(null);
        setEditValue('');
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Gestión de Salarios</CardTitle>
                <CardDescription>
                    Configura los salarios de los usuarios comerciales.
                </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Correo Electrónico</TableHead>
                    <TableHead>Salario Actual</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                     Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i}>
                            <TableCell colSpan={4}><Skeleton className="h-10 w-full" /></TableCell>
                        </TableRow>
                     ))
                  ) : comerciales.length > 0 ? (
                    comerciales.map((user) => (
                        <TableRow key={user.id}>
                            <TableCell>
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-9 w-9">
                                        <AvatarImage src={user.avatarUrl} alt={user.name} />
                                        <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div className="font-medium">{user.name}</div>
                                </div>
                            </TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>
                                {editingId === user.id ? (
                                    <div className="flex items-center gap-2">
                                        <Label htmlFor={`salary-${user.id}`} className="sr-only">Salario</Label>
                                        <Input
                                            id={`salary-${user.id}`}
                                            type="number"
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            placeholder="0"
                                            min="0"
                                            step="0.01"
                                            className="w-32"
                                        />
                                    </div>
                                ) : (
                                    <span>${user.salary?.toLocaleString() || 'No definido'}</span>
                                )}
                            </TableCell>
                            <TableCell className="text-right">
                                {editingId === user.id ? (
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            onClick={() => handleSave(user.id)}
                                            disabled={isPending}
                                        >
                                            {isPending ? 'Guardando...' : 'Guardar'}
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={handleCancel}
                                            disabled={isPending}
                                        >
                                            Cancelar
                                        </Button>
                                    </div>
                                ) : (
                                    <Button
                                        size="sm"
                                        onClick={() => handleEdit(user)}
                                    >
                                        Editar
                                    </Button>
                                )}
                            </TableCell>
                        </TableRow>
                    ))
                  ) : (
                    <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center">
                            No hay usuarios comerciales.
                        </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
        </Card>
    )
}