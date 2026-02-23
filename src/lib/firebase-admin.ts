
import { config } from 'dotenv';
config(); // Load environment variables from .env file

import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

// IMPORTANT: This service account is for demo purposes ONLY.
// In a real application, you MUST secure this file and your service account key.
// Do not commit service account keys to your repository.

async function getPrivateKey(): Promise<string | undefined> {
    try {
        // First try environment variable (Firebase App Hosting injection)
        if (process.env.FIREBASE_PRIVATE_KEY) {
            return process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
        }

        // Try to access the service account secret from App Hosting environment
        if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
            try {
                console.log('Using FIREBASE_SERVICE_ACCOUNT_KEY from environment');
                const keyData = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
                const privateKey = keyData.private_key;
                if (privateKey) {
                    return privateKey.replace(/\\n/g, '\n');
                }
            } catch (parseError) {
                console.warn('Could not parse FIREBASE_SERVICE_ACCOUNT_KEY:', parseError instanceof Error ? parseError.message : String(parseError));
            }
        }

        // Fallback: Try to read from local service account file
        try {
            const fs = require('fs');
            const path = require('path');
            // Try multiple possible locations
            const possiblePaths = [
                path.join(process.cwd(), 'studio-9748962172-82b35-firebase-adminsdk-fbsvc-0ab934a6b7.json'),
                path.join(__dirname, '..', 'studio-9748962172-82b35-firebase-adminsdk-fbsvc-0ab934a6b7.json'),
                '/workspace/studio-9748962172-82b35-firebase-adminsdk-fbsvc-0ab934a6b7.json',
            ];
            for (const keyFile of possiblePaths) {
                if (fs.existsSync(keyFile)) {
                    console.log('Using local service account file:', keyFile);
                    const keyData = JSON.parse(fs.readFileSync(keyFile, 'utf8'));
                    if (keyData.private_key) {
                        return keyData.private_key.replace(/\\n/g, '\n');
                    }
                }
            }
        } catch (localError) {
            console.warn('Could not read local service account file:', localError instanceof Error ? localError.message : String(localError));
        }

        // Fallback: Try to access secret directly from Secret Manager
        try {
            const client = new SecretManagerServiceClient();
            const [version] = await client.accessSecretVersion({
                name: 'projects/studio-9748962172-82b35/secrets/firebase-private-key/versions/latest',
            });
            const secretData = version.payload?.data?.toString();
            if (secretData) {
                console.log('Successfully retrieved private key from Secret Manager');
                // Parse the JSON and extract the private_key field
                const keyData = JSON.parse(secretData);
                const privateKey = keyData.private_key;
                if (privateKey) {
                    // Convert escape sequences to actual newlines
                    return privateKey.replace(/\\n/g, '\n');
                }
            }
        } catch (secretError) {
            console.warn('Could not access secret from Secret Manager:', secretError instanceof Error ? secretError.message : String(secretError));
        }

        // Last fallback: Check for explicit secret name
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
        clientEmail: "firebase-adminsdk-fbsvc@studio-9748962172-82b35.iam.gserviceaccount.com",
    };

    try {
        app = getApps().find(app => app.name === 'admin') || initializeApp({
            credential: cert(serviceAccount),
            databaseURL: "https://studio-9748962172-82b35-default-rtdb.firebaseio.com"
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
