import 'reflect-metadata';
import { env } from './common/env';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { TerminalService } from './modules/terminal/terminal.service';
import { dockerAvailable } from '@oa-lab/execution-engine';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: [env.webOrigin, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/] });
  app.enableShutdownHooks();
  await app.listen(env.port, env.host);
  app.get(TerminalService).attach(app.getHttpServer(), env.webOrigin);
  const log = new Logger('OA Lab');
  log.log(`API listening on http://${env.host}:${env.port} (driver: ${env.driver})`);
  if (env.driver === 'docker' && !(await dockerAvailable())) log.warn('Docker is not reachable — start Docker Desktop, or set OA_EXECUTION_DRIVER=local for unsafe dev mode.');
  if (env.driver === 'local') log.warn('OA_EXECUTION_DRIVER=local: challenge code runs directly on this machine WITHOUT isolation.');
}
void bootstrap();
