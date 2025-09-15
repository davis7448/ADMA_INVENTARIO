
"use client";

import { useEffect, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
  } from '@/components/ui/form';
import { addPlatform } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

const AddPlatformFormSchema = z.object({
  name: z.string().min(1, 'Platform name is required.'),
});

type AddPlatformFormValues = z.infer<typeof AddPlatformFormSchema>;

interface AddPlatformFormProps {
  onPlatformAdded: () => void;
}

export function AddPlatformForm({ onPlatformAdded }: AddPlatformFormProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const form = useForm<AddPlatformFormValues>({
    resolver: zodResolver(AddPlatformFormSchema),
    defaultValues: {
      name: '',
    },
  });

  const onSubmit = (values: AddPlatformFormValues) => {
    startTransition(async () => {
      try {
        await addPlatform(values);
        toast({
          title: 'Success!',
          description: "Platform added successfully.",
        });
        setOpen(false); 
        onPlatformAdded();
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Something went wrong.',
          variant: 'destructive',
        });
      }
    });
  };

  useEffect(() => {
    if (!open) {
      form.reset();
    }
  }, [open, form]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add Platform</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Platform</DialogTitle>
          <DialogDescription>
            Enter the name for the new platform.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Platform Name</FormLabel>
                            <FormControl>
                                <Input placeholder="e.g., Mercado Libre" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="secondary">
                            Cancel
                        </Button>
                    </DialogClose>
                    <Button type="submit" disabled={isPending}>
                        {isPending ? 'Adding Platform...' : 'Add Platform'}
                    </Button>
                </DialogFooter>
            </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
