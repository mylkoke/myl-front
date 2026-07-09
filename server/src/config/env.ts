import 'dotenv/config';

/**
 * Environment validation at startup. Fails fast with a clear message
 * when a required variable is missing in production.
 */
export interface Env {
  port: number;
  nodeEnv: 'development' | 'production' | 'test';
  mongodbUri: string | null;
  corsOrigin: string;
  jwtSecret: string;
  jwtRefreshSecret: string;
  seedAdminUsername: string | null;
  seedAdminPassword: string | null;
  cloudinary: { cloudName: string; apiKey: string; apiSecret: string } | null;
  /** Google Apps Script Web App that saves card images in the user's Drive. */
  gdrive: { url: string; token: string } | null;
}

export function loadEnv(): Env {
  const nodeEnv = (process.env.NODE_ENV ?? 'development') as Env['nodeEnv'];
  const mongodbUri = process.env.MONGODB_URI ?? null;
  const jwtSecret = process.env.JWT_SECRET ?? '';
  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET ?? '';

  if (nodeEnv === 'production') {
    if (!mongodbUri) throw new Error('MONGODB_URI is required in production');
    if (!jwtSecret || !jwtRefreshSecret) {
      throw new Error('JWT_SECRET and JWT_REFRESH_SECRET are required in production');
    }
  }

  return {
    port: Number(process.env.PORT ?? 3000),
    nodeEnv,
    mongodbUri,
    corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    jwtSecret: jwtSecret || 'dev-only-secret',
    jwtRefreshSecret: jwtRefreshSecret || 'dev-only-refresh-secret',
    seedAdminUsername: process.env.SEED_ADMIN_USERNAME ?? null,
    seedAdminPassword: process.env.SEED_ADMIN_PASSWORD ?? null,
    cloudinary:
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
        ? {
            cloudName: process.env.CLOUDINARY_CLOUD_NAME,
            apiKey: process.env.CLOUDINARY_API_KEY,
            apiSecret: process.env.CLOUDINARY_API_SECRET,
          }
        : null,
    gdrive:
      process.env.GAS_UPLOAD_URL && process.env.GAS_UPLOAD_TOKEN
        ? {
            url: process.env.GAS_UPLOAD_URL,
            token: process.env.GAS_UPLOAD_TOKEN,
          }
        : null,
  };
}

export const env = loadEnv();
