
import { config } from 'dotenv';
config(); // Load environment variables from .env file

import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

// IMPORTANT: This service account is for demo purposes ONLY.
// In a real application, you MUST secure this file and your service account key.
// Do not commit service account keys to your repository.

async function getPrivateKey(): Promise<string | undefined> {
    try {
        // In Firebase App Hosting, the secret is injected as an environment variable
        if (process.env.FIREBASE_PRIVATE_KEY) {
            return process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
        }

        // Fallback to Secret Manager if explicitly configured
        if (process.env.FIREBASE_PRIVATE_KEY_SECRET_NAME) {
            const client = new SecretManagerServiceClient();
            const [version] = await client.accessSecretVersion({
                name: `projects/${process.env.GCP_PROJECT_ID || 'studio-9748962172-82b35'}/secrets/${process.env.FIREBASE_PRIVATE_KEY_SECRET_NAME}/versions/latest`,
            });
            return version.payload?.data?.toString();
        }

        return undefined;
    } catch (error) {
        console.error('Error getting Firebase private key:', error);
        return undefined;
    }
}

let app: App;

async function initializeAdminApp() {
    const privateKey = await getPrivateKey();
    console.log('Private key set:', !!privateKey);
    if (!privateKey) {
        console.warn("FIREBASE_PRIVATE_KEY or FIREBASE_PRIVATE_KEY_SECRET_NAME is not set. Firebase Admin SDK will not be initialized. This is expected in client-side rendering.");
        app = {} as App;
        return;
    }

    const serviceAccount = {
        projectId: "studio-9748962172-82b35",
        privateKey: privateKey,
        clientEmail: "firebase-app-hosting-compute@studio-9748962172-82b35.iam.gserviceaccount.com",
    };

    try {
        app = getApps().find(app => app.name === 'admin') || initializeApp({
            credential: cert(serviceAccount),
        }, 'admin');
        console.log('Firebase Admin app initialized');
    } catch(e: any) {
        console.error('Error initializing Firebase Admin:', e.message);
        if (e.message.includes('Failed to parse private key')) {
            throw new Error("FIREBASE_PRIVATE_KEY is invalid. Please check your .env file or secret.");
        }
        throw e;
    }
}

export async function getApp(): Promise<App> {
    if (!app) {
        await initializeAdminApp();
    }
    return app;
}
