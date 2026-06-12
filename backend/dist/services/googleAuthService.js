import { google } from 'googleapis';
import { createOAuthClient, googleScopes } from '../config/google.js';
import { env } from '../config/env.js';
import { decrypt } from '../utils/crypto.js';
import { getUserById, updateUserTokens } from '../repositories/userRepository.js';
import { HttpError } from '../utils/http.js';
export function getGoogleAuthUrl() {
    const client = createOAuthClient();
    return client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: googleScopes
    });
}
export async function exchangeCode(code) {
    const client = createOAuthClient();
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);
    const oauth2 = google.oauth2({ auth: client, version: 'v2' });
    const { data } = await oauth2.userinfo.get();
    if (!data.id || !data.email || !data.name)
        throw new HttpError(400, 'Google profile is incomplete');
    return { profile: data, tokens };
}
export async function getAuthorizedGoogleClient(userId) {
    const user = await getUserById(userId);
    if (!user)
        throw new HttpError(401, 'User not found');
    const client = createOAuthClient();
    client.setCredentials({
        access_token: decrypt(user.access_token),
        refresh_token: decrypt(user.refresh_token),
        expiry_date: user.token_expiry ? new Date(user.token_expiry).getTime() : undefined
    });
    client.on('tokens', async (tokens) => {
        await updateUserTokens(userId, tokens.access_token, tokens.refresh_token, tokens.expiry_date ? new Date(tokens.expiry_date) : null);
    });
    return client;
}
export function redirectWithSession(token) {
    return `${env.FRONTEND_URL}/auth/callback?token=${encodeURIComponent(token)}`;
}
