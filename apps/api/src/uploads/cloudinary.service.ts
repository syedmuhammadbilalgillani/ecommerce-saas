import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { DRIZZLE } from '../db/db.module';
import { type Database, tenantCloudinary, tenants, eq } from '@repo/db';

const ALLOWED_FORMATS = 'jpg,jpeg,png,webp,gif,avif';
const CLOUD_NAME_PATTERN = /^[a-zA-Z0-9_-]{2,64}$/;
const API_KEY_PATTERN = /^[0-9]{6,32}$/;

function encryptionKey(): Buffer {
  const secret = process.env.SECRETS_ENCRYPTION_KEY;
  if (!secret || secret.length < 16) {
    throw new BadRequestException('SECRETS_ENCRYPTION_KEY (min 16 chars) must be set on the API server before saving credentials');
  }
  return createHash('sha256').update(secret).digest();
}

function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64')).join('.');
}

function decrypt(payload: string): string {
  const [iv, tag, data] = payload.split('.').map((p) => Buffer.from(p, 'base64'));
  if (!iv || !tag || !data) throw new Error('Malformed encrypted secret');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

@Injectable()
export class CloudinaryService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** Never includes the secret. */
  async getPublicConfig(tenantId: string) {
    const row = await this.db.query.tenantCloudinary.findFirst({ where: eq(tenantCloudinary.tenantId, tenantId) });
    if (!row) return { configured: false as const };
    return { configured: true as const, cloudName: row.cloudName, apiKey: row.apiKey, updatedAt: row.updatedAt.toISOString() };
  }

  async save(tenantId: string, input: { cloudName?: unknown; apiKey?: unknown; apiSecret?: unknown }) {
    const tenant = await this.db.query.tenants.findFirst({ where: eq(tenants.id, tenantId), columns: { id: true } });
    if (!tenant) throw new NotFoundException(`Tenant '${tenantId}' not found`);

    const cloudName = typeof input.cloudName === 'string' ? input.cloudName.trim() : '';
    const apiKey = typeof input.apiKey === 'string' ? input.apiKey.trim() : '';
    const apiSecret = typeof input.apiSecret === 'string' ? input.apiSecret.trim() : '';
    if (!CLOUD_NAME_PATTERN.test(cloudName)) throw new BadRequestException('cloudName is missing or invalid');
    if (!API_KEY_PATTERN.test(apiKey)) throw new BadRequestException('apiKey must be the numeric Cloudinary API key');
    if (apiSecret.length < 8 || apiSecret.length > 128) throw new BadRequestException('apiSecret is missing or invalid');

    await this.verifyCredentials(cloudName, apiKey, apiSecret);

    const encrypted = encrypt(apiSecret);
    await this.db
      .insert(tenantCloudinary)
      .values({ tenantId, cloudName, apiKey, apiSecretEncrypted: encrypted })
      .onConflictDoUpdate({
        target: tenantCloudinary.tenantId,
        set: { cloudName, apiKey, apiSecretEncrypted: encrypted, updatedAt: new Date() },
      });

    return this.getPublicConfig(tenantId);
  }

  async remove(tenantId: string) {
    const deleted = await this.db.delete(tenantCloudinary).where(eq(tenantCloudinary.tenantId, tenantId)).returning({ id: tenantCloudinary.tenantId });
    if (deleted.length === 0) throw new NotFoundException('No Cloudinary configuration for this tenant');
  }

  /** Signed parameters so the browser can upload straight to Cloudinary without seeing the secret. */
  async signUpload(tenantId: string) {
    const row = await this.db.query.tenantCloudinary.findFirst({ where: eq(tenantCloudinary.tenantId, tenantId) });
    if (!row) throw new NotFoundException('Image uploads are not enabled for this store yet');

    const secret = decrypt(row.apiSecretEncrypted);
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = `posflow/${tenantId}`;
    // Cloudinary signs the alphabetically sorted params joined with & then the secret appended.
    const toSign = `allowed_formats=${ALLOWED_FORMATS}&folder=${folder}&timestamp=${timestamp}${secret}`;
    const signature = createHash('sha1').update(toSign).digest('hex');

    return { cloudName: row.cloudName, apiKey: row.apiKey, timestamp, folder, allowedFormats: ALLOWED_FORMATS, signature };
  }

  private async verifyCredentials(cloudName: string, apiKey: string, apiSecret: string) {
    let res: Response;
    try {
      res = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/ping`, {
        headers: { Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}` },
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      throw new BadRequestException('Could not reach Cloudinary to verify these credentials. Try again.');
    }
    if (res.status === 401 || res.status === 403 || res.status === 404) {
      throw new BadRequestException('Cloudinary rejected these credentials (check cloud name, API key and secret)');
    }
    if (!res.ok) {
      throw new BadRequestException(`Cloudinary verification failed (HTTP ${res.status})`);
    }
  }
}
