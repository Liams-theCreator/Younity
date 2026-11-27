import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventImagesService, eventImageLimit } from './event-images.service.js';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=', 'base64');
let directory: string;
let service: EventImagesService;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'younity-image-'));
  service = new EventImagesService(new ConfigService({ EVENT_IMAGE_DIRECTORY: directory, FRONTEND_ORIGIN: 'https://localhost:8443' }));
});
afterEach(async () => { await rm(directory, { recursive: true, force: true }); });

describe('organizer event image storage', () => {
  it('stores uniquely named images and streams the original bytes', async () => {
    const first = await service.upload({ buffer: png, mimetype: 'image/png' });
    const second = await service.upload({ buffer: png, mimetype: 'image/png' });
    expect(first.url).not.toBe(second.url);
    const filename = new URL(first.url).pathname.split('/').at(-1)!;
    const image = await service.read(filename);
    expect(image.getHeaders().type).toBe('image/png');
    const chunks: Buffer[] = [];
    for await (const chunk of image.getStream()) chunks.push(Buffer.from(chunk));
    expect(Buffer.concat(chunks)).toEqual(png);
    expect(await readdir(directory)).toHaveLength(2);
  });
  it('rejects empty, oversized and unsupported content before writing', async () => {
    await expect(service.upload(undefined)).rejects.toMatchObject({ status: 400 });
    await expect(service.upload({ buffer: Buffer.alloc(eventImageLimit + 1), mimetype: 'image/png' })).rejects.toMatchObject({ status: 400 });
    await expect(service.upload({ buffer: Buffer.from('<svg/>'), mimetype: 'image/png' })).rejects.toMatchObject({ status: 400 });
    await expect(service.upload({ buffer: png, mimetype: 'image/jpeg' })).rejects.toMatchObject({ status: 400 });
    expect(await readdir(directory)).toEqual([]);
  });
  it('rejects invalid paths and absent images', async () => {
    await expect(service.read('../private.env')).rejects.toMatchObject({ status: 404 });
    await expect(service.read('00000000-0000-4000-8000-000000000001.png')).rejects.toMatchObject({ status: 404 });
  });
});
