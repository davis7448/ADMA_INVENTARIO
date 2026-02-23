
import { config } from 'dotenv';
config(); // Load environment variables from .env file

import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

// ULTIMATE FALLBACK: Embedded credentials for Firebase App Hosting
// This is used when no other method (env vars, secrets, local files) works
const EMBEDDED_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCrqinfGetuqONb\ngwprKLEfNxNlqV9ibm6N7ftPJtq9468SjKhpFbZTnuRKcP+XhHiAeMFVo/Bgs9wR\nomSuR0VePgoa8r9n2Ru3jhcGq4OCgjPFEIOk2usQD9VCzR2FK7rlhlAH898ismTV\nPF0B4vgtjclnNL4ZnoDTgT2EGi2ZaXkVxpyzf2oJPCh15LrPLuXkegNfI2XwmJCQ\nzPgPFvvpkadnJo6IGFv0UrUn87JuU5zfJ62wj8mGpq6vxMluNfMEzgUZPS/V9Fb6\nGEPWQDI3dI51YSprBqmHyAJnjrkSRZW8Ye8+gf9SP7qabqZWvXxpg+zhuTbTX70a\no5w9Ym6rAgMBAAECggEAMSZLTsFREyHv1qeyN/QyoklWmGjiEoCjzqcwqPzq7Ctg\nWONE5LF+vnpjypyH0Y3wInhwgmCp1kYo4DOqt+tYBR+mLQkLnGQg93ELTrGUua0l\nvWp5Bp5XZwXhfXrU1OgsXsMR7vT4EisZi6P4zS16+S/7Vj1XoGYtZGFAh64nGCEO\nSzHfAQqooBMjOLF7khTsl7jmKshUCFdLh9ltMrQ9+Zh4yz9RMu2euj9tjH9Gt/EP\nDnI//RQaJrZQQBXdF4wGjXdYoUr0ZF3parZeb95h3DJuk1yKGeBkQii8NV4l7UE1\nD/sSxRCTDu5ywOc/V9VtlcroR7Uvr7nq6RJS5dgHIQKBgQDi3hCK3hgNgBGk3/I5\nzWXMXsfjrIRV81m/7iBHdOCs72pATQ+L/PVWgcrRqmrLRz0DfO5zw3ciuC4Z82ro\nXwdE2m33tRxedGaDwJoQZWnHkX4tKaj1oO4xe3ffyxKQ4XLstza5Ojor8MzZpNfj\nGTxRcTCPfEi4a9NjfFl20PWY3wKBgQDBtWO+hB9bhCYMdMHuRGlzuM9ZVKr5tukV\nTKe1nwypDSqXBT3cCgi/0IesUYm7c2JAHBR3OGe83row/7gqHN1kosp+rNMVY0TW\nU6LbqFOjGIGciYH+5LFoIfb8YbuUeIsHhhFAYjV81dTePVMW26U4kbjzYW+FDMWr\nfbFl3xjHtQKBgQCM3L0AvG3K1B4gdTx9T19Jyf/rCY8Rnwu29C/urk9ikTUzv6VL\nkkDy+ZvpGxs8JHtp0wRrtI4gbKOTUWSr63Uj90wYZce7jiKo48nFLHLFiz0A5cEW\n4lmDN9pyhjB87L7i48+Cqvi7l8RZztSNGXouR02TiePNPoX+W5NhBtW3mQKBgHCc\nFY9E2cHnEgN9wNvWE4O9tXTWHssqxVenh3uzKbYBPHgtCOgpQSrZfHX1tN8vVbe1\nW0RvmwcWaCFiF9sLir0dUiDQMaomWndKicuukGipL3gkDFl085l43U+dNWI7rX9D\nNjY6oaOf368O8YXBTMyVEnMSerVbVnK6kG2Lg6ldAoGBALtMQZw3dODD69HJnzf9\nns9NOR2XvvUC80jTS6Po1jZ7zk8uyHEN4dHrNDXhS+MuXowELz9nhgV+58WlxAfH\npHtUsjPrByaAkIrqS4nvMtezD5ogzHgOv931H4xmcBx77/FbIyp3Hax8rMsDvLDn\nveP+iNYOAwTx0paQxUvb3owD\n-----END PRIVATE KEY-----";

const EMBEDDED_CLIENT_EMAIL = "firebase-adminsdk-fbsvc@studio-9748962172-82b35.iam.gserviceaccount.com";
const EMBEDDED_PROJECT_ID = "studio-9748962172-82b35";

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
                path.join(__dirname, 'studio-9748962172-82b35-firebase-adminsdk-fbsvc-0ab934a6b7.json'),
                '/workspace/studio-9748962172-82b35-firebase-adminsdk-fbsvc-0ab934a6b7.json',
                path.join(process.cwd(), 'src', 'lib', 'studio-9748962172-82b35-firebase-adminsdk-fbsvc-0ab934a6b7.json'),
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
            // Try to require the file directly
            try {
                const keyData = require('../studio-9748962172-82b35-firebase-adminsdk-fbsvc-0ab934a6b7.json');
                if (keyData.private_key) {
                    console.log('Using required service account file');
                    return keyData.private_key.replace(/\\n/g, '\n');
                }
            } catch (e) { /* ignore */ }
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

        // ULTIMATE FALLBACK: Use embedded credentials
        console.log('Using embedded service account credentials (Firebase App Hosting fallback)');
        return EMBEDDED_PRIVATE_KEY;
    } catch (error) {
        console.error('Error getting Firebase private key:', error);
        return EMBEDDED_PRIVATE_KEY; // Return embedded as last resort
    }
}

let app: App;

async function initializeAdminApp() {
    // ULTIMATE FALLBACK: Always use embedded credentials in production
    const privateKey = EMBEDDED_PRIVATE_KEY.replace(/\\n/g, '\n');
    console.log('Using embedded Firebase credentials');
    
    if (!privateKey) {
        console.error("No Firebase private key available");
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
        try {
            await initializeAdminApp();
        } catch (initError) {
            console.error('Failed to initialize Firebase Admin:', initError);
            throw initError;
        }
    }
    return app;
}
