import { describe, it, expect } from 'vitest';

import { 
  DropshippingSchema,
  ApprovalSchema,
  RejectionSchema,
  MAX_IMAGE_SIZE,
  ALLOWED_IMAGE_TYPES
} from '../dropshipping';

describe('Dropshipping - Validation Schemas', () => {
  describe('DropshippingSchema', () => {
    it('should validate valid dropshipping request', () => {
      const validData = {
        productLink: 'https://aliexpress.com/item/123',
        quantity: 100,
        country: 'Colombia',
        observations: 'Test product',
        modality: 'dropshipping' as const,
      };
      
      const result = DropshippingSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate valid bulk request', () => {
      const validData = {
        productLink: 'https://alibaba.com/product/456',
        quantity: 500,
        country: 'China',
        modality: 'bulk' as const,
      };
      
      const result = DropshippingSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid URL', () => {
      const invalidData = {
        productLink: 'not-a-url',
        quantity: 100,
        country: 'Colombia',
        modality: 'dropshipping' as const,
      };
      
      const result = DropshippingSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject negative quantity', () => {
      const invalidData = {
        productLink: 'https://test.com',
        quantity: -10,
        country: 'Colombia',
        modality: 'dropshipping' as const,
      };
      
      const result = DropshippingSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject zero quantity', () => {
      const invalidData = {
        productLink: 'https://test.com',
        quantity: 0,
        country: 'Colombia',
        modality: 'dropshipping' as const,
      };
      
      const result = DropshippingSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should allow both modality', () => {
      const validData = {
        productLink: 'https://test.com',
        quantity: 100,
        country: 'Colombia',
        modality: 'both' as const,
      };
      
      const result = DropshippingSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });
  });

  describe('ApprovalSchema', () => {
    it('should validate valid approval', () => {
      const validData = {
        requestId: 'req-123',
        approvedQuantity: 200,
        approvedModality: 'dropshipping' as const,
        adminResponse: 'Aprobado',
      };
      
      const result = ApprovalSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject negative approved quantity', () => {
      const invalidData = {
        requestId: 'req-123',
        approvedQuantity: -50,
        approvedModality: 'dropshipping' as const,
      };
      
      const result = ApprovalSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('RejectionSchema', () => {
    it('should validate valid rejection', () => {
      const validData = {
        requestId: 'req-123',
        adminResponse: 'Producto no disponible',
      };
      
      const result = RejectionSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject empty admin response', () => {
      const invalidData = {
        requestId: 'req-123',
        adminResponse: '',
      };
      
      const result = RejectionSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
});

describe('Dropshipping - Constants', () => {
  it('should have correct max image size (5MB)', () => {
    const expectedSize = 5 * 1024 * 1024;
    expect(MAX_IMAGE_SIZE).toBe(expectedSize);
  });

  it('should have allowed image types', () => {
    expect(ALLOWED_IMAGE_TYPES).toContain('image/jpeg');
    expect(ALLOWED_IMAGE_TYPES).toContain('image/png');
    expect(ALLOWED_IMAGE_TYPES).toContain('image/webp');
    expect(ALLOWED_IMAGE_TYPES.length).toBe(3);
  });
});

describe('Dropshipping - Image Validation Logic', () => {
  it('should validate JPEG type', () => {
    const file = { type: 'image/jpeg', size: 1024 * 1024 };
    const isValid = ALLOWED_IMAGE_TYPES.includes(file.type) && file.size <= MAX_IMAGE_SIZE;
    expect(isValid).toBe(true);
  });

  it('should validate PNG type', () => {
    const file = { type: 'image/png', size: 1024 * 1024 };
    const isValid = ALLOWED_IMAGE_TYPES.includes(file.type) && file.size <= MAX_IMAGE_SIZE;
    expect(isValid).toBe(true);
  });

  it('should reject non-image type', () => {
    const file = { type: 'application/pdf', size: 1024 };
    const isValid = ALLOWED_IMAGE_TYPES.includes(file.type) && file.size <= MAX_IMAGE_SIZE;
    expect(isValid).toBe(false);
  });

  it('should reject oversized image', () => {
    const file = { type: 'image/jpeg', size: 10 * 1024 * 1024 };
    const isValid = ALLOWED_IMAGE_TYPES.includes(file.type) && file.size <= MAX_IMAGE_SIZE;
    expect(isValid).toBe(false);
  });
});
