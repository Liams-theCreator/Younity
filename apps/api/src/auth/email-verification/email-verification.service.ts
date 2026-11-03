import { Injectable, Post } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';

@Injectable()
export class EmailVerificationService {
  constructor(private readonly prisma: PrismaService) { }

  async verifyEmail() { }
}
