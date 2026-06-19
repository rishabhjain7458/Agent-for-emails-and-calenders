import dotenv from 'dotenv';

dotenv.config();

const required = ['DATABASE_URL', 'JWT_SECRET', 'TOKEN_ENCRYPTION_KEY'] as const;

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: Number(process.env.PORT ?? 4000),
  FRONTEND_URL: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  MOBILE_APP_URL: process.env.MOBILE_APP_URL ?? 'oconnect://app',
  FRONTEND_ORIGINS: (process.env.FRONTEND_URL ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  DATABASE_URL: process.env.DATABASE_URL!,
  JWT_SECRET: process.env.JWT_SECRET!,
  TOKEN_ENCRYPTION_KEY: process.env.TOKEN_ENCRYPTION_KEY!,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? '',
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:4000/api/auth/google/callback',
  MICROSOFT_CLIENT_ID: process.env.MICROSOFT_CLIENT_ID ?? '',
  MICROSOFT_CLIENT_SECRET: process.env.MICROSOFT_CLIENT_SECRET ?? '',
  MICROSOFT_REDIRECT_URI: process.env.MICROSOFT_REDIRECT_URI ?? 'http://localhost:4000/api/auth/microsoft/callback',
  ZOHO_CLIENT_ID: process.env.ZOHO_CLIENT_ID ?? '',
  ZOHO_CLIENT_SECRET: process.env.ZOHO_CLIENT_SECRET ?? '',
  ZOHO_REDIRECT_URI: process.env.ZOHO_REDIRECT_URI ?? 'http://localhost:4000/api/auth/zoho/callback',
  ZOHO_ACCOUNTS_URL: process.env.ZOHO_ACCOUNTS_URL ?? 'https://accounts.zoho.com',
  ZOHO_MAIL_API_URL: process.env.ZOHO_MAIL_API_URL ?? 'https://mail.zoho.com',
  FACEBOOK_CLIENT_ID: process.env.FACEBOOK_CLIENT_ID ?? '',
  FACEBOOK_CLIENT_SECRET: process.env.FACEBOOK_CLIENT_SECRET ?? '',
  FACEBOOK_REDIRECT_URI: process.env.FACEBOOK_REDIRECT_URI ?? 'http://localhost:4000/api/auth/social/facebook/callback',
  INSTAGRAM_CLIENT_ID: process.env.INSTAGRAM_CLIENT_ID ?? '',
  INSTAGRAM_CLIENT_SECRET: process.env.INSTAGRAM_CLIENT_SECRET ?? '',
  INSTAGRAM_REDIRECT_URI: process.env.INSTAGRAM_REDIRECT_URI ?? 'http://localhost:4000/api/auth/social/instagram/callback',
  INSTAGRAM_OAUTH_MODE: process.env.INSTAGRAM_OAUTH_MODE === 'basic' ? 'basic' : 'business',
  LINKEDIN_CLIENT_ID: process.env.LINKEDIN_CLIENT_ID ?? '',
  LINKEDIN_CLIENT_SECRET: process.env.LINKEDIN_CLIENT_SECRET ?? '',
  LINKEDIN_REDIRECT_URI: process.env.LINKEDIN_REDIRECT_URI ?? 'http://localhost:4000/api/auth/social/linkedin/callback',
  X_CLIENT_ID: process.env.X_CLIENT_ID ?? '',
  X_CLIENT_SECRET: process.env.X_CLIENT_SECRET ?? '',
  X_REDIRECT_URI: process.env.X_REDIRECT_URI ?? 'http://localhost:4000/api/auth/social/x/callback',
  REDDIT_CLIENT_ID: process.env.REDDIT_CLIENT_ID ?? '',
  REDDIT_CLIENT_SECRET: process.env.REDDIT_CLIENT_SECRET ?? '',
  REDDIT_REDIRECT_URI: process.env.REDDIT_REDIRECT_URI ?? 'http://localhost:4000/api/auth/social/reddit/callback',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? '',
  GEMINI_MODEL: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'
};
