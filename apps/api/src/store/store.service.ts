import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DRIZZLE } from '../db/db.module';
import { type Database, stores, eq } from '@repo/db';
import { normalizePhone } from '../customers/customers.service';

export interface StoreSettings {
  id: string;
  name: string;
  slug: string;
  currency: string;
  whatsappPhone: string | null;
}

export interface UpdateStoreSettingsDto {
  name?: string;
  whatsappPhone?: string | null;
}

@Injectable()
export class StoreService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async getSettings(storeId: string): Promise<StoreSettings> {
    const store = await this.db.query.stores.findFirst({
      where: eq(stores.id, storeId),
      columns: { id: true, name: true, slug: true, currency: true, whatsappPhone: true },
    });
    if (!store) throw new NotFoundException('Store not found');
    return store;
  }

  async updateSettings(storeId: string, dto: UpdateStoreSettingsDto): Promise<StoreSettings> {
    const patch: { name?: string; whatsappPhone?: string | null; updatedAt: Date } = { updatedAt: new Date() };

    if (dto?.name !== undefined) {
      const name = typeof dto.name === 'string' ? dto.name.trim() : '';
      if (name.length < 2 || name.length > 80) {
        throw new BadRequestException('Store name must be 2–80 characters');
      }
      patch.name = name;
    }

    if (dto?.whatsappPhone !== undefined) {
      if (dto.whatsappPhone === null || (typeof dto.whatsappPhone === 'string' && !dto.whatsappPhone.trim())) {
        patch.whatsappPhone = null;
      } else {
        const phone = normalizePhone(String(dto.whatsappPhone));
        // wa.me needs a full international number: country code + subscriber number.
        if (!/^\+\d{10,15}$/.test(phone)) {
          throw new BadRequestException('WhatsApp number must include the country code, e.g. +923001234567 or 03001234567');
        }
        patch.whatsappPhone = phone;
      }
    }

    await this.db.update(stores).set(patch).where(eq(stores.id, storeId));
    return this.getSettings(storeId);
  }
}
