import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get('health')
  healthCheck() {
    return {
      status: 'ok',
      engine: 'NestJS + Fastify',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
