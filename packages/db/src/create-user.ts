/**
 * Creates a login for the merchant admin or the platform admin.
 *
 *   pnpm db:create-user --role platform_admin --email you@example.com
 *   pnpm db:create-user --role merchant --email owner@brand.pk --tenant ten_pilot_01
 *
 * The password is read from a hidden prompt (or the POSFLOW_PASSWORD env var for scripting),
 * so it never lands in shell history.
 */
import './load-env';
import { randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline';
import { createDbClient, users, tenants, eq, hashPassword, MIN_PASSWORD_LENGTH } from './index.ts';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const output = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
    output._writeToOutput = (s: string) => {
      if (s.includes(question)) output.output.write(s);
      else output.output.write('*');
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

async function main() {
  const role = arg('role');
  const email = arg('email')?.trim().toLowerCase();
  const tenantId = arg('tenant');
  const name = arg('name') ?? null;
  const platformRole = arg('platform-role') ?? 'super_admin';

  if (role !== 'merchant' && role !== 'platform_admin') {
    throw new Error('--role must be "merchant" or "platform_admin"');
  }
  if (!email || !email.includes('@')) {
    throw new Error('--email is required');
  }
  if (role === 'merchant' && !tenantId) {
    throw new Error('--tenant is required for merchant users');
  }
  if (role === 'platform_admin' && !['super_admin', 'support', 'viewer'].includes(platformRole)) {
    throw new Error('--platform-role must be "super_admin", "support", or "viewer"');
  }

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is missing');
  const db = createDbClient(url);

  if (role === 'merchant') {
    const tenant = await db.query.tenants.findFirst({ where: eq(tenants.id, tenantId!) });
    if (!tenant) throw new Error(`Tenant '${tenantId}' not found`);
  }

  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing) throw new Error(`A user with email ${email} already exists`);

  const password = process.env.POSFLOW_PASSWORD ?? (await promptHidden(`Password for ${email}: `));
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }

  const id = `user_${randomBytes(12).toString('hex')}`;
  await db.insert(users).values({
    id,
    email,
    name,
    passwordHash: await hashPassword(password),
    role,
    tenantId: role === 'merchant' ? tenantId! : null,
    platformRole: role === 'platform_admin' ? platformRole : null,
  });

  console.log(`✅ Created ${role} ${email} (${id})`);
  process.exit(0);
}

main().catch((err) => {
  console.error(`❌ ${err.message}`);
  process.exit(1);
});
