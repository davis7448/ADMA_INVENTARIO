// Script to initialize the specific API token for SISTEMA AUDITORIA
// Run this in the browser console or as an API call

const initializeSpecificToken = async () => {
  const tokenData = {
    token: 'tk_adma_abc123xyz789',
    clientName: 'SISTEMA AUDITORIA',
    clientId: 'sistema-auditoria',
    createdBy: 'admin',
    createdAt: new Date(),
    isActive: true,
    rateLimitPerMinute: 100,
    allowedOrigins: ['https://adma-auditoria.web.app'],
    lastUsedAt: null,
    totalRequests: 0
  };

  try {
    // Import Firestore
    const { db } = await import('./firebase');
    const { doc, setDoc } = await import('firebase/firestore');
    
    await setDoc(doc(db, 'api_tokens', tokenData.token), tokenData);
    
    console.log('✅ Token initialized successfully!');
    console.log('Token:', tokenData.token);
    console.log('Client:', tokenData.clientName);
    return { success: true, token: tokenData.token };
  } catch (error) {
    console.error('❌ Error initializing token:', error);
    return { success: false, error };
  }
};

// Export for use
export { initializeSpecificToken };

// Auto-run if in browser
if (typeof window !== 'undefined') {
  // Make it available globally for console use
  (window as any).initializeApiToken = initializeSpecificToken;
}