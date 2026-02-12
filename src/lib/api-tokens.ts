import { db } from './firebase';
import { doc, getDoc, updateDoc, setDoc, serverTimestamp, collection, query, where, getDocs, addDoc } from 'firebase/firestore';

export interface ApiToken {
  token: string;
  clientName: string;
  clientId: string;
  createdBy: string;
  createdAt: any;
  isActive: boolean;
  rateLimitPerMinute: number;
  allowedOrigins: string[];
  lastUsedAt: any;
  totalRequests: number;
}

export interface TokenValidationResult {
  valid: boolean;
  token?: ApiToken;
  error?: string;
}

export interface RateLimitInfo {
  allowed: boolean;
  remaining: number;
  resetTime: Date;
  currentCount: number;
}

const API_TOKENS_COLLECTION = 'api_tokens';
const RATE_LIMIT_COLLECTION = 'api_rate_limits';

/**
 * Validate an API token
 */
export async function validateApiToken(token: string): Promise<TokenValidationResult> {
  try {
    const tokenDoc = await getDoc(doc(db, API_TOKENS_COLLECTION, token));
    
    if (!tokenDoc.exists()) {
      return { valid: false, error: 'Invalid token' };
    }
    
    const tokenData = tokenDoc.data() as ApiToken;
    
    if (!tokenData.isActive) {
      return { valid: false, error: 'Token is inactive' };
    }
    
    return { valid: true, token: tokenData };
  } catch (error) {
    console.error('Error validating token:', error);
    return { valid: false, error: 'Internal error' };
  }
}

/**
 * Check rate limit for a token
 */
export async function checkRateLimit(token: string, limitPerMinute: number): Promise<RateLimitInfo> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - 60 * 1000); // 1 minute window
  const resetTime = new Date(now.getTime() + 60 * 1000);
  
  try {
    // Get or create rate limit document
    const rateLimitRef = doc(db, RATE_LIMIT_COLLECTION, token);
    const rateLimitDoc = await getDoc(rateLimitRef);
    
    let currentCount = 0;
    let windowStartTime = windowStart;
    
    if (rateLimitDoc.exists()) {
      const data = rateLimitDoc.data();
      const lastWindowStart = data.windowStart?.toDate();
      
      // If we're in the same window, increment count
      if (lastWindowStart && lastWindowStart > windowStart) {
        currentCount = data.count || 0;
        windowStartTime = lastWindowStart;
      }
    }
    
    // Check if limit exceeded
    if (currentCount >= limitPerMinute) {
      return {
        allowed: false,
        remaining: 0,
        resetTime,
        currentCount
      };
    }
    
    // Increment counter
    await setDoc(rateLimitRef, {
      token,
      count: currentCount + 1,
      windowStart: serverTimestamp(),
      lastRequest: serverTimestamp()
    }, { merge: true });
    
    return {
      allowed: true,
      remaining: limitPerMinute - currentCount - 1,
      resetTime,
      currentCount: currentCount + 1
    };
  } catch (error) {
    console.error('Error checking rate limit:', error);
    // Allow request on error to prevent blocking
    return {
      allowed: true,
      remaining: limitPerMinute,
      resetTime,
      currentCount: 0
    };
  }
}

/**
 * Update token usage statistics
 */
export async function updateTokenUsage(token: string): Promise<void> {
  try {
    const tokenRef = doc(db, API_TOKENS_COLLECTION, token);
    await updateDoc(tokenRef, {
      lastUsedAt: serverTimestamp(),
      totalRequests: increment(1)
    });
  } catch (error) {
    console.error('Error updating token usage:', error);
  }
}

/**
 * Generate a new API token
 */
export function generateApiToken(): string {
  const prefix = 'tk_adma_';
  const randomPart = Array.from({ length: 20 }, () => 
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 62)]
  ).join('');
  return prefix + randomPart;
}

/**
 * Create a new API token
 */
export async function createApiToken(
  clientName: string,
  clientId: string,
  createdBy: string,
  allowedOrigins: string[],
  rateLimitPerMinute: number = 100
): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    const token = generateApiToken();
    
    await setDoc(doc(db, API_TOKENS_COLLECTION, token), {
      token,
      clientName,
      clientId,
      createdBy,
      createdAt: serverTimestamp(),
      isActive: true,
      rateLimitPerMinute,
      allowedOrigins,
      lastUsedAt: null,
      totalRequests: 0
    });
    
    return { success: true, token };
  } catch (error) {
    console.error('Error creating token:', error);
    return { success: false, error: 'Failed to create token' };
  }
}

/**
 * List all API tokens
 */
export async function listApiTokens(): Promise<ApiToken[]> {
  try {
    const q = query(collection(db, API_TOKENS_COLLECTION), where('isActive', '==', true));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => doc.data() as ApiToken);
  } catch (error) {
    console.error('Error listing tokens:', error);
    return [];
  }
}

/**
 * Revoke an API token
 */
export async function revokeApiToken(token: string): Promise<{ success: boolean; error?: string }> {
  try {
    await updateDoc(doc(db, API_TOKENS_COLLECTION, token), {
      isActive: false,
      revokedAt: serverTimestamp()
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error revoking token:', error);
    return { success: false, error: 'Failed to revoke token' };
  }
}

// Helper for increment
function increment(n: number) {
  return { __type: 'increment', value: n };
}