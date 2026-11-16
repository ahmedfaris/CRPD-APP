// Letters Archive System — router and startup.
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.ts';
import { logger } from '../utils/logger.ts';
import { initLasTables } from './db.ts';
import { flushAuditBuffer, verifyAuditChain } from './core.ts';
import adminRoutes from './adminRoutes.ts';
import letterRoutes from './letterRoutes.ts';

const router = Router();
router.use(requireAuth); // every archive request needs a signed-in user; roles are checked per request
router.use(adminRoutes);
router.use(letterRoutes);
export default router;

/** Create the tables, store audit events buffered during an outage, and check the audit chain daily (SL-6, SL-8). */
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
}
