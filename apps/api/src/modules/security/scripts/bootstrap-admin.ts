import '@/config/apply-env';

import { env } from '@/config';
import { logger } from '@/lib/logger';
import { closeMongo } from '@/lib/infra/mongo';
import { AuthService } from '../services/auth.service';

const log = logger.child({ module: 'security.bootstrap' });

/**
 * Create the first control-plane administrator.
 *
 * The credentials are read from the environment so the secret never appears
 * in the repository, in the process arguments or in the audit ledger:
 *
 *   API_BOOTSTRAP_ADMIN_EMAIL
 *   API_BOOTSTRAP_ADMIN_PASSWORD
 *   API_BOOTSTRAP_ADMIN_NAME   (optional, defaults to "Control Plane Admin")
 *
 * The script is idempotent: when the account already exists it reports the
 * existing identity and exits without creating a duplicate.
 */
async function main(): Promise<void> {
  const email = process.env.API_BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.API_BOOTSTRAP_ADMIN_PASSWORD;
  const displayName = process.env.API_BOOTSTRAP_ADMIN_NAME?.trim() || 'Control Plane Admin';

  if (!email || !password) {
    throw new Error(
      'Set API_BOOTSTRAP_ADMIN_EMAIL and API_BOOTSTRAP_ADMIN_PASSWORD before running the bootstrap.',
    );
  }

  const created = await AuthService.createUser({
    email,
    displayName,
    role: 'admin',
    password,
    scopes: [],
  });

  log.info(
    { userId: created.userId, email: created.email, role: created.role, env: env.ENV },
    'Bootstrap administrator created',
  );
  console.warn(`[bootstrap] admin created: ${created.email} (${created.userId})`);
}

main()
  .then(async () => {
    await closeMongo();
    process.exit(0);
  })
  .catch(async (err: Error) => {
    console.error('[bootstrap] failed:', err.message);
    await closeMongo();
    process.exit(1);
  });
