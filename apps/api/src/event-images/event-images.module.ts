import { AuthModule } from '../auth/auth.module.js';
import { Module } from '@nestjs/common';
import { EventImagesController } from './event-images.controller.js';
import { EventImagesService } from './event-images.service.js';

@Module({ imports: [AuthModule], controllers: [EventImagesController], providers: [EventImagesService] })
export class EventImagesModule {}
