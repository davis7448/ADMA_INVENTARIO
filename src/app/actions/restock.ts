"use server";

import { generateRestockAlert, RestockAlertInput, RestockAlertOutput } from "@/ai/flows/restock-alert-generation";
import { z } from "zod";

const RestockAlertFormSchema = z.object({
  productName: z.string().min(1, "El nombre del producto es requerido."),
  vendorName: z.string().min(1, "El nombre del proveedor es requerido."),
  currentInventory: z.coerce.number().min(0, "El inventario debe ser un número no negativo."),
  restockThreshold: z.coerce.number().min(0, "El umbral debe ser un número no negativo."),
});

export type FormState = {
  message: string;
  result?: RestockAlertOutput;
  errors?: {
    productName?: string[];
    vendorName?: string[];
    currentInventory?: string[];
    restockThreshold?: string[];
  };
};

export async function checkRestock(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  const validatedFields = RestockAlertFormSchema.safeParse({
    productName: formData.get("productName"),
    vendorName: formData.get("vendorName"),
    currentInventory: formData.get("currentInventory"),
    restockThreshold: formData.get("restockThreshold"),
  });

  if (!validatedFields.success) {
    return {
      message: "La validación falló. Por favor, revisa tus entradas.",
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  try {
    const input: RestockAlertInput = validatedFields.data;
    const result = await generateRestockAlert(input);
    return {
      message: "La verificación de reabastecimiento se completó con éxito.",
      result,
    };
  } catch (error) {
    console.error(error);
    return {
      message: "Ocurrió un error inesperado. Por favor, inténtalo de nuevo.",
    };
  }
}
