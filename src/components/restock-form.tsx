
"use client";

import { useState, useEffect, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { checkRestock, FormState } from "@/app/actions/restock";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";

const RestockAlertFormSchema = z.object({
  productName: z.string().min(1, "El nombre del producto es requerido."),
  vendorName: z.string().min(1, "El nombre del proveedor es requerido."),
  currentInventory: z.coerce.number().min(0, "El inventario debe ser un número no negativo."),
  restockThreshold: z.coerce.number().min(0, "El umbral debe ser un número no negativo."),
});

type FormValues = z.infer<typeof RestockAlertFormSchema>;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Generando..." : "Generar Alerta"}
    </Button>
  );
}

export default function RestockForm() {
  const [state, setState] = useState<FormState>({ message: "", errors: {} });
  const [isPending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    resolver: zodResolver(RestockAlertFormSchema),
    defaultValues: {
      productName: "",
      vendorName: "",
      currentInventory: 0,
      restockThreshold: 0,
    },
  });

  const onSubmit = (formData: FormData) => {
    startTransition(async () => {
      const result = await checkRestock(state, formData);
      setState(result);
    });
  };

  useEffect(() => {
    if (state.errors) {
      Object.entries(state.errors).forEach(([key, value]) => {
        form.setError(key as keyof FormValues, {
          type: "manual",
          message: value?.[0],
        });
      });
    }
  }, [state, form]);

  return (
    <Card>
      <Form {...form}>
        <form action={onSubmit}>
          <CardHeader>
            <CardTitle className="font-headline">Herramienta de Alerta de Reabastecimiento</CardTitle>
            <CardDescription>
              Verifica manualmente si un producto necesita ser reabastecido usando IA.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="productName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre del Producto</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Ratón Inalámbrico Ergonómico" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="vendorName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre del Proveedor</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Suministros Tecnológicos Globales" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <FormField
                control={form.control}
                name="currentInventory"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Inventario Actual</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="restockThreshold"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Umbral de Reabastecimiento</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
             {state.result && (
              <Alert variant={state.result.restockNeeded ? "destructive" : "default"}>
                {state.result.restockNeeded ? (
                  <AlertCircle className="h-4 w-4" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                <AlertTitle>{state.result.restockNeeded ? "Reabastecimiento Requerido" : "Inventario OK"}</AlertTitle>
                <AlertDescription>
                  {state.result.alertMessage}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Generando..." : "Generar Alerta"}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
