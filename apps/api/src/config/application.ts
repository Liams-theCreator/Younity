import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Environment } from './environment.js';

export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });
}

export function configureApplication(
  app: INestApplication,
  environment: Environment,
): void {
  app.setGlobalPrefix('api');
  app.enableCors({ origin: environment.corsOrigins, credentials: true });
  app.useGlobalPipes(createValidationPipe());
  const config = new DocumentBuilder()
    .setTitle('Younity API')
    .setDescription('Campus events and opportunities API')
    .setVersion('0.1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
}
