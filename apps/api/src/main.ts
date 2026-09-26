import * as dotenv from 'dotenv';
dotenv.config();

import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { TelemetryService } from './common/telemetry.service';

function parseTrustProxy(value: string | undefined): boolean | number | string {
  if (!value) return false;
  if (/^\d+$/.test(value)) return Number(value);
  if (value === 'true') return true;
  return value; // comma-separated list of trusted proxy IPs/CIDRs
}

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      // Structured JSON request logs (pino). Session cookies and tokens are never written to logs.
      logger: {
        level: process.env.LOG_LEVEL || 'info',
        redact: ['req.headers.authorization', 'req.headers.cookie', 'req.headers["x-order-token"]', 'res.headers["set-cookie"]'],
      },
      // Honor X-Request-Id from an upstream proxy, otherwise mint one; it is echoed back on every response.
      requestIdHeader: 'x-request-id',
      genReqId: () => randomUUID(),
      // Rate limits key on the client IP. Set TRUST_PROXY to the NUMBER of proxies in front of the API
      // (e.g. 1 when admin apps reach it through their /api rewrite, 2 with a load balancer too) so the
      // real IP is read from X-Forwarded-For. Avoid "true": it trusts any forged header.
      trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
      bodyLimit: 1024 * 1024,
    })
  );

  app.getHttpAdapter().getInstance().addHook('onSend', async (req, reply) => {
    reply.header('x-request-id', req.id);
  });

  const telemetry = app.get(TelemetryService);
  app.getHttpAdapter().getInstance().addHook('onResponse', async (req, reply) => {
    telemetry.recordLatency(reply.elapsedTime);
  });

  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();

  // Cookies carry the admin sessions, so CORS must name the allowed origins explicitly.
  const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:3001,http://localhost:3002')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    exposedHeaders: ['x-request-id', 'retry-after'],
  });

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
  await app.listen(port, '0.0.0.0');
  new Logger('Bootstrap').log(`API listening on port ${port}`);
}

bootstrap();
