

"use client";

import { useState, useTransition, useMemo, useEffect } from 'react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from '@/components/ui/select';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { MoreHorizontal } from 'lucide-react';
import type { User, UserRole, Warehouse } from '@/lib/types';
import { updateUserRoleAction, resetUserPasswordAction, updateUserWarehouseAction } from '@/app/actions/users';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from './ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { CreateUserDialog } from './create-user-dialog';

interface UserManagementProps {
    initialUsers: User[];
    loading: boolean;
    onUsersUpdate: () => void;
    warehouses: Warehouse[];
}

export function UserManagement({ initialUsers, loading, onUsersUpdate, warehouses }: UserManagementProps) {
    // Filter states
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedRole, setSelectedRole] = useState('all');
    const [users, setUsers] = useState<User[]>(initialUsers);

    useEffect(() => {
        setUsers(initialUsers);
    }, [initialUsers]);

    const filteredUsers = useMemo(() => {
        return users.filter(user => {
            const lowercasedQuery = searchQuery.toLowerCase();
            const searchMatch = searchQuery === '' || 
                                user.name.toLowerCase().includes(lowercasedQuery) || 
                                user.email.toLowerCase().includes(lowercasedQuery);
            
            const roleMatch = selectedRole === 'all' || user.role === selectedRole;

            return searchMatch && roleMatch;
        });
    }, [users, searchQuery, selectedRole]);

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Gestión de Usuarios</CardTitle>
                        <CardDescription>
                            Gestiona los roles y bodegas de los usuarios. La lista de usuarios aparecerá una vez desplegada la aplicación.
                        </CardDescription>
                    </div>
                    <CreateUserDialog onUserCreated={onUsersUpdate} />
                </div>
            </CardHeader>
            <CardContent>
                <div className="p-4 mb-4 border rounded-lg bg-muted/50">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="user-search">Buscar por nombre o correo</Label>
                            <Input
                                id="user-search"
                                placeholder="Escribe para buscar..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div>
                            <Label htmlFor="role-filter">Filtrar por rol</Label>
                            <Select value={selectedRole} onValueChange={setSelectedRole}>
                                <SelectTrigger id="role-filter">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos los Roles</SelectItem>
                                    <SelectItem value="admin">Admin</SelectItem>
                                    <SelectItem value="plataformas">Plataformas</SelectItem>
                                    <SelectItem value="logistics">Logística</SelectItem>
                                    <SelectItem value="commercial">Comercial</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Correo Electrónico</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Bodega Asignada</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                     Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i}>
                            <TableCell colSpan={5}><Skeleton className="h-10 w-full" /></TableCell>
                        </TableRow>
                     ))
                  ) : filteredUsers.length > 0 ? (
                    filteredUsers.map((user) => (
                        <UserRow key={user.id} user={user} onUsersUpdate={onUsersUpdate} warehouses={warehouses} />
                    ))
                  ) : (
                    <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center">
                            La lista de usuarios estará disponible después de desplegar la aplicación.
                        </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
        </Card>
    )
}

function UserRow({ user, onUsersUpdate, warehouses }: { user: User; onUsersUpdate: () => void; warehouses: Warehouse[] }) {
    const [isRolePending, startRoleTransition] = useTransition();
    const [isWarehousePending, startWarehouseTransition] = useTransition();
    const [isResetPending, startResetTransition] = useTransition();
    const { toast } = useToast();

    const handleRoleChange = (newRole: UserRole) => {
        startRoleTransition(async () => {
            const result = await updateUserRoleAction(user.id, newRole);
            if (result.success) {
                toast({ title: '¡Éxito!', description: result.message });
                onUsersUpdate();
            } else {
                toast({ title: 'Error', description: result.message, variant: 'destructive' });
            }
        });
    };

    const handleWarehouseChange = (newWarehouseId: string) => {
        startWarehouseTransition(async () => {
            const result = await updateUserWarehouseAction(user.id, newWarehouseId);
            if (result.success) {
                toast({ title: '¡Éxito!', description: 'Bodega asignada correctamente.' });
                onUsersUpdate();
            } else {
                toast({ title: 'Error', description: 'No se pudo asignar la bodega.', variant: 'destructive' });
            }
        });
    };

    const handlePasswordReset = () => {
        startResetTransition(async () => {
            const result = await resetUserPasswordAction(user.email);
            if (result.success) {
                toast({ title: '¡Éxito!', description: result.message });
            } else {
                toast({ title: 'Error', description: result.message, variant: 'destructive' });
            }
        });
    }

    const canChangeWarehouse = user.role === 'logistics' || user.role === 'plataformas';


    return (
         <TableRow>
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
                <Select onValueChange={handleRoleChange} defaultValue={user.role} disabled={isRolePending}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="plataformas">Plataformas</SelectItem>
                        <SelectItem value="logistics">Logística</SelectItem>
                        <SelectItem value="commercial">Comercial</SelectItem>
                    </SelectContent>
                </Select>
            </TableCell>
            <TableCell>
                 <Select 
                    onValueChange={handleWarehouseChange} 
                    defaultValue={user.warehouseId || 'none'}
                    disabled={isWarehousePending || !canChangeWarehouse}
                 >
                    <SelectTrigger className="w-[200px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">Sin Asignar</SelectItem>
                        {warehouses.map(wh => (
                            <SelectItem key={wh.id} value={wh.id}>{wh.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </TableCell>
            <TableCell className="text-right">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                        <DropdownMenuItem onSelect={handlePasswordReset} disabled={isResetPending}>
                            {isResetPending ? "Enviando..." : "Restablecer Contraseña"}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </TableCell>
        </TableRow>
    )
}
