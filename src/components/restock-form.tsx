"use client";

import { useActionState, useEffect } from "react";
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
  productName: z.string().min(1, "Product name is required."),
  vendorName: z.string().min(1, "Vendor name is required."),
  currentInventory: z.coerce.number().min(0, "Inventory must be a non-negative number."),
  restockThreshold: z.coerce.number().min(0, "Threshold must be a non-negative number."),
});

type FormValues = z.infer<typeof RestockAlertFormSchema>;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Generating..." : "Generate Alert"}
    </Button>
  );
}

export default function RestockForm() {
  const initialState: FormState = { message: "", errors: {} };
  const [state, formAction] = useActionState(checkRestock, initialState);

  const form = useForm<FormValues>({
    resolver: zodResolver(RestockAlertFormSchema),
    defaultValues: {
      productName: "",
      vendorName: "",
      currentInventory: 0,
      restockThreshold: 0,
    },
  });

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
        <form action={formAction}>
          <CardHeader>
            <CardTitle className="font-headline">Restock Alert Tool</CardTitle>
            <CardDescription>
              Manually check if a product needs restocking using AI.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="productName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Ergo-Wireless Mouse" {...field} />
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
                    <FormLabel>Vendor Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Global Tech Supplies" {...field} />
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
                    <FormLabel>Current Inventory</FormLabel>
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
                    <FormLabel>Restock Threshold</FormLabel>
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
                <AlertTitle>{state.result.restockNeeded ? "Restock Required" : "Inventory OK"}</AlertTitle>
                <AlertDescription>
                  {state.result.alertMessage}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter>
            <SubmitButton />
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
