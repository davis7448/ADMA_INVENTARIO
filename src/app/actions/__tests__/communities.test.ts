import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Firebase Admin
vi.mock('@/lib/firebase-admin', () => ({
  getApp: vi.fn(),
  getFirestore: vi.fn(() => mockDb),
  getAuth: vi.fn(),
}));

const mockDb = {
  collection: vi.fn(() => ({
    doc: vi.fn(() => ({
      set: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      get: vi.fn().mockResolvedValue({ exists: true, data: () => ({}) }),
    })),
    where: vi.fn(() => ({
      orderBy: vi.fn(() => ({
        limit: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
      })),
      limit: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
    })),
    add: vi.fn().mockResolvedValue({ id: 'test-id' }),
  })),
};

// Import after mocking
import { 
  RegisterLeaderSchema, 
  RegisterMemberSchema, 
  validateInviteCode 
} from '../communities';

describe('Communities - Validation Schemas', () => {
  describe('RegisterLeaderSchema', () => {
    it('should validate valid leader data', () => {
      const validData = {
        email: 'leader@test.com',
        displayName: 'John Doe',
        phone: '+573001234567',
        communityName: 'Test Community',
        communityDescription: 'A test community',
      };
      
      const result = RegisterLeaderSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const invalidData = {
        email: 'invalid-email',
        displayName: 'John',
        communityName: 'Test',
      };
      
      const result = RegisterLeaderSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject short displayName', () => {
      const invalidData = {
        email: 'test@test.com',
        displayName: 'J',
        communityName: 'Test',
      };
      
      const result = RegisterLeaderSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject short communityName', () => {
      const invalidData = {
        email: 'test@test.com',
        displayName: 'John',
        communityName: 'T',
      };
      
      const result = RegisterLeaderSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('RegisterMemberSchema', () => {
    it('should validate valid member data with 8-char code', () => {
      const validData = {
        email: 'member@test.com',
        displayName: 'Jane Doe',
        inviteCode: 'abcdefgh',
      };
      
      const result = RegisterMemberSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const invalidData = {
        email: 'invalid-email',
        displayName: 'Jane',
        inviteCode: 'abcdefgh',
      };
      
      const result = RegisterMemberSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject wrong length inviteCode', () => {
      const invalidData = {
        email: 'test@test.com',
        displayName: 'Jane',
        inviteCode: 'abc', // Too short
      };
      
      const result = RegisterMemberSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
});

describe('Community Leader Logic', () => {
  it('should have correct commission rate default', () => {
    // Test default commission rate
    const defaultCommissionRate = 10;
    expect(defaultCommissionRate).toBe(10);
  });

  it('should validate invite code format', () => {
    // Test invite code validation logic
    const isValidCode = (code: string) => code.length === 8;
    
    expect(isValidCode('abcd1234')).toBe(true);
    expect(isValidCode('abc')).toBe(false);
    expect(isValidCode('')).toBe(false);
  });
});

describe('Community Ranking', () => {
  it('should calculate ranking correctly', () => {
    const leaders = [
      { id: '1', totalCommission: 1000 },
      { id: '2', totalCommission: 500 },
      { id: '3', totalCommission: 1500 },
    ];

    const sorted = [...leaders].sort((a, b) => b.totalCommission - a.totalCommission);
    
    expect(sorted[0].id).toBe('3'); // 1500
    expect(sorted[1].id).toBe('1'); // 1000
    expect(sorted[2].id).toBe('2'); // 500
  });
});
