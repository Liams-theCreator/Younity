import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApplication } from './config/application.js';
import { validateEnvironment } from './config/environment.js';

async function bootstrap() {
  const environment = validateEnvironment();
  const app = await NestFactory.create(AppModule);
  configureApplication(app, environment);
  app.enableShutdownHooks();
  await app.listen(environment.port, '0.0.0.0');
}

await bootstrap();
