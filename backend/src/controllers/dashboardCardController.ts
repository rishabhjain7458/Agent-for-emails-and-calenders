import type { NextFunction, Request, Response } from 'express';
import { createDashboardCard, deleteDashboardCard, getDashboardCardOrder, listDashboardCards, updateDashboardCardOrder } from '../repositories/dashboardCardRepository.js';
import { send } from '../utils/http.js';

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
    const card = await createDashboardCard(req.user!.tenantId, req.user!.id, req.body);
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
