import axios from 'axios';
import { getMicrosoftAccessToken } from './microsoftAuthService.js';
const graph = 'https://graph.microsoft.com/v1.0';
function mapQuery(query) {
    const filters = [];
    if (query.includes('is:unread'))
        filters.push('isRead eq false');
    if (query.includes('has:attachment'))
        filters.push('hasAttachments eq true');
    const newerThan = query.match(/newer_than:(\d+)d/);
    if (newerThan) {
        const date = new Date(Date.now() - Number(newerThan[1]) * 24 * 60 * 60 * 1000).toISOString();
        filters.push(`receivedDateTime ge ${date}`);
    }
    return {
        folder: query.includes('in:sent') ? 'sentitems' : 'inbox',
        filter: filters.join(' and ')
    };
}
function mapMessage(message) {
    return {
        id: message.id,
        threadId: message.id,
        subject: message.subject || '(No subject)',
        sender: message.from?.emailAddress?.address ?? message.sender?.emailAddress?.address ?? '',
        date: message.receivedDateTime ?? message.sentDateTime ?? '',
        unread: message.isRead === false,
        snippet: message.bodyPreview ?? '',
        body: message.body?.content ?? ''
    };
}
export async function listMicrosoftEmails(userId, query = 'in:inbox', maxResults = 20) {
    const token = await getMicrosoftAccessToken(userId);
    const mapped = mapQuery(query);
    const params = {
        '$top': maxResults,
        '$orderby': 'receivedDateTime desc',
        '$select': 'id,conversationId,subject,from,sender,receivedDateTime,sentDateTime,isRead,bodyPreview,hasAttachments'
    };
    if (mapped.filter)
        params.$filter = mapped.filter;
    const { data } = await axios.get(`${graph}/me/mailFolders/${mapped.folder}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
        params
    });
    const messages = (data.value ?? []).map(mapMessage);
    return { messages, nextPageToken: data['@odata.nextLink'], resultSizeEstimate: messages.length };
}
export async function getMicrosoftEmail(userId, messageId) {
    const token = await getMicrosoftAccessToken(userId);
    const { data } = await axios.get(`${graph}/me/messages/${messageId}`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { '$select': 'id,subject,from,sender,receivedDateTime,isRead,bodyPreview,body,hasAttachments' }
    });
    return mapMessage(data);
}
export async function sendMicrosoftReply(userId, input) {
    const token = await getMicrosoftAccessToken(userId);
    await axios.post(`${graph}/me/messages/${input.threadId}/reply`, {
        message: { body: { contentType: 'Text', content: input.body } }
    }, {
        headers: { Authorization: `Bearer ${token}` }
    });
    return { sent: true };
}
export async function archiveMicrosoftEmail(userId, messageId) {
    const token = await getMicrosoftAccessToken(userId);
    const { data: archiveFolder } = await axios.get(`${graph}/me/mailFolders/archive`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    await axios.post(`${graph}/me/messages/${messageId}/move`, {
        destinationId: archiveFolder.id
    }, {
        headers: { Authorization: `Bearer ${token}` }
    });
}
export async function deleteMicrosoftEmail(userId, messageId) {
    const token = await getMicrosoftAccessToken(userId);
    await axios.delete(`${graph}/me/messages/${messageId}`, {
        headers: { Authorization: `Bearer ${token}` }
    });
}
