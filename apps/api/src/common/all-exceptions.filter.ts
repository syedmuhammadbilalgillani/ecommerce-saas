import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * Known HTTP errors pass through unchanged. Anything unexpected is logged with the request id
 * and stack, and the client gets a generic 500 carrying that id (so support can find the log line)
 * but never internal details such as SQL errors.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Unhandled');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<FastifyRequest>();
    const reply = ctx.getResponse<FastifyReply>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      if (status >= 500) {
        this.logger.error(`${req.method} ${req.url} -> ${status} [req ${req.id}]`, (exception as Error).stack);
      }
      reply.status(status).send(typeof body === 'string' ? { statusCode: status, message: body } : body);
      return;
    }

    const err = exception as Error;
    this.logger.error(`${req.method} ${req.url} -> 500 [req ${req.id}]: ${err?.message}`, err?.stack);
    reply.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
      statusCode: 500,
      message: 'Internal server error',
      requestId: req.id,
    });
  }
}
