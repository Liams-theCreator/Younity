import 'dotenv/config';
import { validateDatabaseUrl } from './database.js';

export interface Environment {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  databaseUrl: string;
  corsOrigins: string[];
}

export function validateEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): Environment {
  const nodeEnv = env.NODE_ENV ?? 'development';
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    throw new Error('NODE_ENV must be development, test, or production');
  }
  const portText = env.PORT ?? '3000';
  const port = Number(portText);
  if (
    !/^\d+$/.test(portText) ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  const databaseUrl = validateDatabaseUrl(env.DATABASE_URL);
  if (nodeEnv === 'production' && !env.CORS_ORIGINS?.trim()) {
    throw new Error('CORS_ORIGINS is required in production');
  }
  const corsOrigins = (
    env.CORS_ORIGINS ?? 'https://localhost,http://localhost:5173'
  )
    .split(',')
    .map((origin) => origin.trim());
  for (const origin of corsOrigins) {
    try {
      const url = new URL(origin);
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.origin !== origin ||
        url.username ||
        url.password
      ) {
        throw new Error();
      }
    } catch {
      throw new Error(
        'CORS_ORIGINS must contain comma-separated HTTP(S) origins without paths or wildcards',
      );
    }
  }
  return {
    nodeEnv: nodeEnv as Environment['nodeEnv'],
    port,
    databaseUrl,
    corsOrigins,
  };
}
