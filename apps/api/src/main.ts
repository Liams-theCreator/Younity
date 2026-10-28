import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import cookieParser from 'cookie-parser';
import { configureApplication } from './config/application.js';
import { validateEnvironment } from './config/environment.js';

async function bootstrap() {
  const environment = validateEnvironment();
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.enableShutdownHooks();
  configureApplication(app, environment);
  await app.listen(environment.port, '0.0.0.0');
}

await bootstrap();
