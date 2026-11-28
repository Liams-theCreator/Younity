import { BadRequestException, Injectable, NotFoundException, StreamableFile } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { mkdir, open, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

export type EventImageFile = { buffer: Buffer; mimetype: string };
export const eventImageLimit = 5 * 1024 * 1024;

function imageExtension(file: EventImageFile) {
  const bytes = file.buffer;
  if (file.mimetype === 'image/png' && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png';
  if (file.mimetype === 'image/jpeg' && bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) return 'jpg';
  if (file.mimetype === 'image/webp' && bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP') return 'webp';
  throw new BadRequestException('Choose a PNG, JPG or WebP image.');
}

@Injectable()
export class EventImagesService {
  constructor(private readonly config: ConfigService) {}

  private directory() {
    return resolve(this.config.get<string>('EVENT_IMAGE_DIRECTORY') ?? 'uploads/event-images');
  }

  async upload(file: EventImageFile | undefined) {
    if (!file?.buffer?.length || file.buffer.length > eventImageLimit) {
      throw new BadRequestException('Choose a PNG, JPG or WebP image up to 5 MB.');
    }
    const extension = imageExtension(file);
    const filename = `${randomUUID()}.${extension}`;
    const directory = this.directory();
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, filename), file.buffer, { flag: 'wx' });
    return {
      url: new URL(`/api/organizer-event-images/${filename}`, this.config.getOrThrow<string>('FRONTEND_ORIGIN')).href,
    };
  }

  async read(filename: string) {
    if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}\.(png|jpg|webp)$/.test(filename)) {
      throw new NotFoundException('Image not found.');
    }
    let file;
    try {
      file = await open(join(this.directory(), filename), 'r');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new NotFoundException('Image not found.');
      throw error;
    }
    const type = filename.endsWith('.jpg') ? 'image/jpeg' : filename.endsWith('.png') ? 'image/png' : 'image/webp';
    return new StreamableFile(file.createReadStream(), { type });
  }
}
