import type { NextFunction, Request, Response } from 'express';
import { createDashboardCard, deleteDashboardCard, getDashboardCardOrder, listDashboardCards, updateDashboardCardOrder } from '../repositories/dashboardCardRepository.js';
import { send } from '../utils/http.js';

function socialHandleFromUrl(value: string) {
  try {
    const parsed = new URL(value);
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parsed.hostname.includes('reddit.com') && parts[0]?.toLowerCase() === 'user') return parts[1] ?? '';
    if (parsed.hostname.includes('threads.net')) return parts[0]?.replace(/^@/, '') ?? '';
    return parts[0]?.replace(/^@/, '') ?? '';
  } catch {
    return value.trim().replace(/^@/, '').replace(/^\/+/, '').replace(/^u\//i, '');
  }
}

function socialAvatarUrl(platform?: string | null, url?: string) {
  if (!platform || !url) return '';
  const handle = socialHandleFromUrl(url);
  if (!handle) return '';
  const provider = platform === 'x' ? 'twitter' : platform;
  return `https://unavatar.io/${provider}/${encodeURIComponent(handle)}`;
}

function enrichDashboardCardInput(input: any) {
  if (input.cardType !== 'social') return input;
  const metadata = { ...(input.metadata ?? {}) };
  if (!metadata.imageUrl) {
    const imageUrl = socialAvatarUrl(input.platform, input.url);
    if (imageUrl) metadata.imageUrl = imageUrl;
  }
  return { ...input, metadata };
}

export async function index(req: Request, res: Response, next: NextFunction) {
  try {
    const [cards, cardOrder] = await Promise.all([
      listDashboardCards(req.user!.tenantId, req.user!.id),
      getDashboardCardOrder(req.user!.tenantId, req.user!.id)
    ]);
    send(res, { cards, cardOrder });
  } catch (error) {
    next(error);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const card = await createDashboardCard(req.user!.tenantId, req.user!.id, enrichDashboardCardInput(req.body));
    const currentOrder = await getDashboardCardOrder(req.user!.tenantId, req.user!.id);
    const cardId = `custom:${card.id}`;
    if (!currentOrder.includes(cardId)) {
      await updateDashboardCardOrder(req.user!.tenantId, req.user!.id, [...currentOrder, cardId]);
    }
    send(res, card, 201);
  } catch (error) {
    next(error);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await deleteDashboardCard(req.user!.tenantId, req.user!.id, req.params.id);
    const currentOrder = await getDashboardCardOrder(req.user!.tenantId, req.user!.id);
    await updateDashboardCardOrder(
      req.user!.tenantId,
      req.user!.id,
      currentOrder.filter((cardId: string) => cardId !== `custom:${req.params.id}`)
    );
    send(res, { deleted: true });
  } catch (error) {
    next(error);
  }
}

export async function updateOrder(req: Request, res: Response, next: NextFunction) {
  try {
    send(res, { cardOrder: await updateDashboardCardOrder(req.user!.tenantId, req.user!.id, req.body.cardOrder) });
  } catch (error) {
    next(error);
  }
}
