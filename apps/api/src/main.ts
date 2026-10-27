import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ValidationPipe } from '@nestjs/common';
import  cookieParser  from 'cookie-parser';
import { ConfigService } from '@nestjs/config';
import { configureApplication } from './config/application.js';
import { validateEnvironment } from './config/environment.js';



//Enable validationPipe, allows DTO properties with validation decorators
async function bootstrap() {
  const environment = validateEnvironment();
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  app.enableCors({
	  origin: config.getOrThrow<string>('FRONTEND_ORIGIN'),
	  credentials: true,
  });
  app.use(cookieParser());
  app.enableShutdownHooks();
  app.useGlobalPipes(
	  new ValidationPipe({
		  whitelist: true,
		  forbidNonWhitelisted: true,
		  transform: true,
	  }),
  );
  app.setGlobalPrefix('api');
  configureApplication(app, environment);
  await app.listen(environment.port, '0.0.0.0');
};

await bootstrap();
