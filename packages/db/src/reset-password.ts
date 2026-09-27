/**
 * Sets a new password for any user (platform admin or merchant) and signs them out everywhere.
 *
 *   pnpm db:reset-password --email you@example.com
 *
 * The password is read from a hidden prompt (or POSFLOW_PASSWORD for scripting).
 */
import './load-env';
import { createInterface } from 'node:readline';
import { createDbClient, users, sessions, eq, hashPassword, MIN_PASSWORD_LENGTH } from './index.ts';

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
  const email = arg('email')?.trim().toLowerCase();
  if (!email) throw new Error('--email is required');

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is missing');
  const db = createDbClient(url);

  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user) throw new Error(`No user with email ${email}`);

  const password = process.env.POSFLOW_PASSWORD ?? (await promptHidden(`New password for ${email}: `));
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }

  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash: await hashPassword(password), updatedAt: new Date() }).where(eq(users.id, user.id));
    await tx.delete(sessions).where(eq(sessions.userId, user.id));
  });

  console.log(`✅ Password reset for ${email} (${user.role}); all their sessions were signed out.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(`❌ ${err.message}`);
  process.exit(1);
});
