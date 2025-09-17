
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';

// IMPORTANT: This service account is for demo purposes ONLY.
// In a real application, you MUST secure this file and your service account key.
// Do not commit service account keys to your repository.
const serviceAccount = {
  "type": "service_account",
  "project_id": "studio-9748962172-82b35",
  "private_key_id": "d991b01c312480373e226ad5a34241ce80c05423",
  "private_key": process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  "client_email": "firebase-adminsdk-i4p1b@studio-9748962172-82b35.iam.gserviceaccount.com",
  "client_id": "117281057431109312213",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-i4p1b%40studio-9748962172-82b35.iam.gserviceaccount.com"
};

const app: App = getApps().find(app => app.name === 'admin') || initializeApp({
  credential: cert(serviceAccount),
}, 'admin');

export { app };
