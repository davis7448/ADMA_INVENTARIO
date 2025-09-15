
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogClose,
  } from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
  } from '@/components/ui/form';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from '@/components/ui/select';
import { Input } from './ui/input';
import { MoreHorizontal, PlusCircle } from 'lucide-react';
import type { User, UserRole } from '@/lib/types';
import type { CreateUserFormValues } from '@/lib/definitions';
import { CreateUserFormSchema } from '@/lib/definitions';
import { createUserAction, updateUserRoleAction, resetUserPasswordAction } from '@/app/actions/users';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from './ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';

interface UserManagementProps {
    initialUsers: User[];
    loading: boolean;
    onUsersUpdate: () => void;
}

export function UserManagement({ initialUsers, loading, onUsersUpdate }: UserManagementProps) {
    const [isAddUserOpen, setIsAddUserOpen] = useState(false);
    const { toast } = useToast();

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>User Management</CardTitle>
                        <CardDescription>
                            Create users, assign roles, and manage access.
                        </CardDescription>
                    </div>
                    <AddUserDialog onUserAdded={() => { setIsAddUserOpen(false); onUsersUpdate(); }}>
                        <Button>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Add User
                        </Button>
                    </AddUserDialog>
                </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                     Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i}>
                            <TableCell colSpan={4}><Skeleton className="h-10 w-full" /></TableCell>
                        </TableRow>
                     ))
                  ) : initialUsers.length > 0 ? (
                    initialUsers.map((user) => (
                        <UserRow key={user.id} user={user} onUsersUpdate={onUsersUpdate} />
                    ))
                  ) : (
                    <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center">No users found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
        </Card>
    )
}

function UserRow({ user, onUsersUpdate }: { user: User; onUsersUpdate: () => void; }) {
    const [isRolePending, startRoleTransition] = useTransition();
    const [isResetPending, startResetTransition] = useTransition();
    const { toast } = useToast();

    const handleRoleChange = (newRole: UserRole) => {
        startRoleTransition(async () => {
            const result = await updateUserRoleAction(user.id, newRole);
            if (result.success) {
                toast({ title: 'Success!', description: result.message });
                onUsersUpdate();
            } else {
                toast({ title: 'Error', description: result.message, variant: 'destructive' });
            }
        });
    };

    const handlePasswordReset = () => {
        startResetTransition(async () => {
            const result = await resetUserPasswordAction(user.email);
            if (result.success) {
                toast({ title: 'Success!', description: result.message });
            } else {
                toast({ title: 'Error', description: result.message, variant: 'destructive' });
            }
        });
    }

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
                        <SelectItem value="logistics">Logistics</SelectItem>
                        <SelectItem value="commercial">Commercial</SelectItem>
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
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onSelect={handlePasswordReset} disabled={isResetPending}>
                            {isResetPending ? "Sending..." : "Reset Password"}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </TableCell>
        </TableRow>
    )
}

function AddUserDialog({ children, onUserAdded }: { children: React.ReactNode, onUserAdded: () => void }) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const form = useForm<CreateUserFormValues>({
        resolver: zodResolver(CreateUserFormSchema),
        defaultValues: {
            name: '',
            email: '',
            password: '',
            role: 'commercial',
        },
    });

    const onSubmit = (values: CreateUserFormValues) => {
        startTransition(async () => {
            const result = await createUserAction(values);
            if (result.success) {
                toast({ title: 'Success!', description: result.message });
                onUserAdded();
                setOpen(false);
                form.reset();
            } else {
                toast({ title: 'Error', description: result.message, variant: 'destructive' });
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add New User</DialogTitle>
                    <DialogDescription>
                        Create a new user and assign them a role. They will receive an email to set their password.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Full Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="John Doe" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Email</FormLabel>
                                    <FormControl>
                                        <Input type="email" placeholder="user@example.com" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="password"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Password</FormLabel>
                                    <FormControl>
                                        <Input type="password" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="role"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Role</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="admin">Admin</SelectItem>
                                            <SelectItem value="logistics">Logistics</SelectItem>
                                            <SelectItem value="commercial">Commercial</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                            <DialogClose asChild>
                                <Button type="button" variant="secondary">Cancel</Button>
                            </DialogClose>
                            <Button type="submit" disabled={isPending}>
                                {isPending ? 'Creating...' : 'Create User'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

