// Letters Archive System — router and startup.
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.ts';
import { logger } from '../utils/logger.ts';
import { initLasTables } from './db.ts';
import { flushAuditBuffer, verifyAuditChain } from './core.ts';
import adminRoutes from './adminRoutes.ts';
import letterRoutes from './letterRoutes.ts';
import { captureRouter, agentRouter } from './capture/routes.ts';
import { initCapture } from './capture/service.ts';

const router = Router();
router.use(requireAuth); // every archive request needs a signed-in user; roles are checked per request
router.use(adminRoutes);
router.use(captureRouter);
router.use(letterRoutes);
export default router;

/** Scanning agent endpoints: authenticated by a one-time scan ticket instead of a session. */
export const lasAgentRouter = agentRouter;

/** Create the tables, store audit events buffered during an outage, check the audit chain daily (SL-6, SL-8), start capture. */
export async function initLas(): Promise<void> {
  await initLasTables();
  try {
    const replayed = await flushAuditBuffer();
    if (replayed) logger.warning('Stored {Count} buffered audit events', { LogType: 'Technical', Count: replayed });
  } catch (e: any) {
    logger.error('Buffered audit events could not be stored: {Error}', { LogType: 'Technical', Error: e?.message });
  }
  const check = () => verifyAuditChain().catch((e: any) => logger.error('Audit chain check failed: {Error}', { LogType: 'Technical', Error: e?.message }));
  setTimeout(check, 15_000).unref?.();
  setInterval(check, 24 * 60 * 60 * 1000).unref?.();
  try {
    await initCapture();
  } catch (e: any) {
    logger.error('Capture could not start: {Error}', { LogType: 'Technical', Error: e?.message });
  }
}
