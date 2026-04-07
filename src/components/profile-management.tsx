
"use client";

import { useState, useTransition, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Image from 'next/image';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from './ui/input';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { updateUserAction } from '@/app/actions/users';
import type { UpdateProfileFormValues } from '@/lib/definitions';
import { UpdateProfileFormSchema } from '@/lib/definitions';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from './ui/skeleton';

export function ProfileManagement() {
  const { user, loading: authLoading } = useAuth();
  const [isPending, startTransition] = useTransition();
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const { toast } = useToast();

  const form = useForm<UpdateProfileFormValues>({
    resolver: zodResolver(UpdateProfileFormSchema),
    defaultValues: {
      name: '',
      phone: '',
      avatar: undefined,
    },
  });

  useEffect(() => {
    if (user) {
      form.reset({
        name: user.name || '',
        phone: user.phone || '',
      });
    }
  }, [user, form]);

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      form.setValue('avatar', file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = (values: UpdateProfileFormValues) => {
    if (!user) {
        toast({ title: 'Error', description: 'Debes iniciar sesión.', variant: 'destructive' });
        return;
    }
    const formData = new FormData();
    formData.append('name', values.name);
    if (values.phone) {
        formData.append('phone', values.phone);
    }
    if (values.avatar instanceof File) {
        formData.append('avatar', values.avatar);
    }

    startTransition(async () => {
      const result = await updateUserAction(user.id, formData);
      if (result.success) {
        toast({ title: '¡Éxito!', description: result.message });
        setPreviewImage(null); // Clear preview after successful upload
        // The page will revalidate and show the new data
      } else {
        toast({ title: 'Error', description: result.message, variant: 'destructive' });
      }
    });
  };

  if (authLoading) {
    return (
        <Card>
            <CardHeader>
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-4 w-2/3" />
            </CardHeader>
            <CardContent>
                <div className="flex items-center gap-6">
                    <Skeleton className="h-24 w-24 rounded-full" />
                    <div className="flex-1 space-y-4">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                </div>
            </CardContent>
            <CardFooter>
                 <Skeleton className="h-10 w-32" />
            </CardFooter>
        </Card>
    )
  }

  if (!user) {
    return null; // Or some other placeholder
  }

  return (
    <Card>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardHeader>
            <CardTitle>Mi Perfil</CardTitle>
            <CardDescription>
              Actualiza tu información personal y foto de perfil.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row items-start gap-6">
              <div className="flex flex-col items-center gap-4">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={previewImage || user.avatarUrl} alt={user.name} />
                  <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <FormField
                  control={form.control}
                  name="avatar"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                         <Button asChild variant="outline">
                            <label htmlFor="avatar-upload" className="cursor-pointer">
                                Cambiar Foto
                                <Input
                                    id="avatar-upload"
                                    type="file"
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handleAvatarChange}
                                />
                            </label>
                        </Button>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex-1 grid grid-cols-1 gap-4 w-full">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre Completo</FormLabel>
                      <FormControl>
                        <Input placeholder="Tu nombre" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teléfono</FormLabel>
                      <FormControl>
                        <Input placeholder="Tu número de teléfono" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <div>
                    <FormLabel>Correo Electrónico</FormLabel>
                    <Input value={user.email} disabled />
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="border-t px-6 py-4">
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
