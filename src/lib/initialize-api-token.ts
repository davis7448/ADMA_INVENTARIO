// Script to initialize the API token for SISTEMA AUDITORIA
// Run this once to create the initial token

import { createApiToken } from './api-tokens';

async function initializeToken() {
  const result = await createApiToken(
    'SISTEMA AUDITORIA',
    'sistema-auditoria',
    'admin',
    ['https://adma-auditoria.web.app'],
    100
  );

  if (result.success) {
    console.log('✅ Token created successfully!');
    console.log('Token:', result.token);
  } else {
    console.error('❌ Error creating token:', result.error);
  }
}

// Run if executed directly
if (require.main === module) {
  initializeToken();
}

export { initializeToken };