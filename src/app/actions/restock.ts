"use server";

import { generateRestockAlert, RestockAlertInput, RestockAlertOutput } from "@/ai/flows/restock-alert-generation";
import { z } from "zod";

const RestockAlertFormSchema = z.object({
  productName: z.string().min(1, "Product name is required."),
  vendorName: z.string().min(1, "Vendor name is required."),
  currentInventory: z.coerce.number().min(0, "Inventory must be a non-negative number."),
  restockThreshold: z.coerce.number().min(0, "Threshold must be a non-negative number."),
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
      message: "Validation failed. Please check your inputs.",
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  try {
    const input: RestockAlertInput = validatedFields.data;
    const result = await generateRestockAlert(input);
    return {
      message: "Restock check completed successfully.",
      result,
    };
  } catch (error) {
    console.error(error);
    return {
      message: "An unexpected error occurred. Please try again.",
    };
  }
}
