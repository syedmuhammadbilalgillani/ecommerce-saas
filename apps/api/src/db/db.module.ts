import { Global, Module } from '@nestjs/common';
import { createDbClient, type Database } from '@repo/db';

export const DRIZZLE = Symbol('DRIZZLE_CLIENT');

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE,
      useFactory: (): Database => {
        const connectionString =
          process.env.DATABASE_URL || '';
        return createDbClient(connectionString);
      },
    },
  ],
  exports: [DRIZZLE],
})
export class DbModule {}
