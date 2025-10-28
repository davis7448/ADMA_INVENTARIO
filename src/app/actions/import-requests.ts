"use server";

import { createImportRequest, uploadImageAndGetURL } from '@/lib/api';
import { ImportRequest } from '@/lib/types';

export async function createImportRequestAction(formData: FormData) {
  try {
    console.log('Server action received FormData');

    const productName = formData.get('productName') as string;
    const userId = formData.get('userId') as string;
    const userName = formData.get('userName') as string;
    const imageFile = formData.get('image') as File;
    const referenceLink = formData.get('referenceLink') as string;

    console.log('Extracted values:', { productName, imageFile, referenceLink, userId, userName });

    // Handle image upload if present (exactly like the product form)
    let finalImageUrl: string | undefined = undefined;
    if (imageFile && imageFile instanceof File) {
      try {
        console.log('Uploading image file:', imageFile.name);
        finalImageUrl = await uploadImageAndGetURL(imageFile);
        console.log('Image uploaded successfully:', finalImageUrl);
      } catch (error) {
        console.error('Error uploading image:', error);
        // Continue without image if upload fails
        finalImageUrl = undefined;
      }
    }

    if (!productName || !userId || !userName) {
      throw new Error('Missing required fields');
    }

    // Create a plain object without any special prototypes
    const requestData: any = {
      requestDate: new Date().toISOString(),
      requestedBy: {
        id: userId,
        name: userName,
      },
      productName,
      status: 'solicitado' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Only add optional fields if they have values
    if (finalImageUrl && finalImageUrl.trim()) {
      requestData.imageUrl = finalImageUrl.trim();
    }
    if (referenceLink && referenceLink.trim()) {
      requestData.referenceLink = referenceLink.trim();
    }

    console.log('Final request data:', JSON.stringify(requestData, null, 2));

    const result = await createImportRequest(requestData);
    console.log('Import request created successfully:', result);

    return { success: true, id: result };
  } catch (error) {
    console.error('Error in createImportRequestAction:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}