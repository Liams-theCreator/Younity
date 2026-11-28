import { Controller, Get, Header, Param, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { UserRole } from '../generated/prisma/enums.js';
import { EventImagesService, eventImageLimit } from './event-images.service.js';
import type { EventImageFile } from './event-images.service.js';

@ApiTags('Organizer event images')
@Controller('organizer-event-images')
export class EventImagesController {
  constructor(private readonly images: EventImagesService) {}

  @Post()
  @ApiCookieAuth()
  @Roles(UserRole.ORGANIZER)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: eventImageLimit, files: 1, fields: 0 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiOperation({ summary: 'Upload a banner for an approved organizer event' })
  upload(@UploadedFile() file: EventImageFile | undefined) {
    return this.images.upload(file);
  }

  @Get(':filename')
  @Header('Cache-Control', 'public, max-age=31536000, immutable')
  @Header('X-Content-Type-Options', 'nosniff')
  read(@Param('filename') filename: string) {
    return this.images.read(filename);
  }
}
