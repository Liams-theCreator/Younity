import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApplication } from '../src/config/application.js';
import { validateEnvironment } from '../src/config/environment.js';

// Require an explicit test URL so this suite never silently uses the developer DB.
if (!process.env.TEST_DATABASE_URL)
  throw new Error('TEST_DATABASE_URL is required for database tests');
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.NODE_ENV = 'test';

describe('API foundation (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApplication(app, validateEnvironment());
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('serves the root endpoint under /api', async () => {
    await request(app.getHttpServer())
      .get('/api')
      .expect(200)
      .expect('Hello World!');
    await request(app.getHttpServer()).get('/').expect(404);
  });

  it('checks real database connectivity', async () => {
    await request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('publishes Swagger with prefixed endpoints', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);
    expect(response.body.paths).toHaveProperty('/api/health');
    await request(app.getHttpServer()).get('/api/docs/').expect(200);
  });

  it('allows configured browser origins and excludes unknown origins', async () => {
    await request(app.getHttpServer())
      .options('/api/health')
      .set('Origin', 'https://localhost')
      .set('Access-Control-Request-Method', 'GET')
      .expect(204)
      .expect('Access-Control-Allow-Origin', 'https://localhost');
    const response = await request(app.getHttpServer())
      .get('/api/health')
      .set('Origin', 'https://untrusted.example')
      .expect(200);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});
