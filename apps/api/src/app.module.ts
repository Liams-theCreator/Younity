import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ConfigModule } from '@nestjs/config'
import { validateEnvironment } from './config/env.validation.js'
import { AuthModule } from './auth/auth.module.js'

@Module({
  imports: [
	  ConfigModule.forRoot({
		  isGlobal: true,
		  validate: validateEnvironment,
	  }),
	  PrismaModule,
	  AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
