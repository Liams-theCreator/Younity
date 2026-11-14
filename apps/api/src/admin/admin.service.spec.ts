import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

describe('AdminService decisions', () => {
  const tx = {
    organizationApplication: { updateMany: vi.fn(), findUnique: vi.fn() },
    organization: { findUnique: vi.fn(), updateMany: vi.fn() },
    user: { findUnique: vi.fn(), updateMany: vi.fn() },
    applicationDecision: { create: vi.fn() },
    decisionEmail: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  const service = new AdminService(tx as unknown as PrismaService);
  beforeEach(() => {
    vi.resetAllMocks();
    tx.$transaction.mockImplementation((cb) => cb(tx));
    tx.organizationApplication.updateMany.mockResolvedValue({ count: 1 });
    tx.organizationApplication.findUnique.mockResolvedValue({
      organizationId: 'org',
      submittedById: 'other',
    });
    tx.organization.findUnique.mockResolvedValue({
      id: 'org',
      ownerId: 'owner',
    });
    tx.user.findUnique.mockResolvedValue({
      id: 'owner',
      email: 'owner@example.invalid',
    });
    tx.organization.updateMany.mockResolvedValue({ count: 1 });
    tx.user.updateMany.mockResolvedValue({ count: 1 });
    tx.applicationDecision.create.mockResolvedValue({ id: 'decision' });
  });
  it('approves the actual owner and queues one audited notification', async () => {
    expect(await service.approveApplication('app', 'admin', 'ok', 1)).toBe(1);
    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'owner',
        role: 'ORGANIZER',
        status: { in: ['PENDING', 'ACTIVE'] },
      },
      data: { status: 'ACTIVE' },
    });
    expect(tx.organization.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          verificationStatus: 'APPROVED',
          verifiedAt: expect.any(Date),
          verifiedById: 'admin',
        },
      }),
    );
    expect(tx.applicationDecision.create).toHaveBeenCalledTimes(1);
    expect(tx.decisionEmail.create).toHaveBeenCalledTimes(1);
  });
  it.each(['rejectApplication', 'requestChangesApplication'] as const)(
    '%s leaves organization and user unchanged',
    async (method) => {
      expect(await service[method]('app', 'admin', 'reason', 1)).toBe(1);
      expect(tx.user.updateMany).not.toHaveBeenCalled();
      expect(tx.organization.updateMany).not.toHaveBeenCalled();
      expect(tx.applicationDecision.create).toHaveBeenCalledTimes(1);
    },
  );
  it('returns 404 for missing application', async () => {
    tx.organizationApplication.updateMany.mockResolvedValue({ count: 0 });
    tx.organizationApplication.findUnique.mockResolvedValue(null);
    await expect(
      service.approveApplication('app', 'admin', 'ok', 1),
    ).rejects.toThrow(NotFoundException);
  });
  it('returns conflict without audit on duplicate', async () => {
    tx.organizationApplication.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.approveApplication('app', 'admin', 'ok', 1),
    ).rejects.toThrow(ConflictException);
    expect(tx.applicationDecision.create).not.toHaveBeenCalled();
  });
  it.each(['organization', 'user'] as const)(
    'rejects missing %s',
    async (model) => {
      tx[model].findUnique.mockResolvedValue(null);
      await expect(
        service.approveApplication('app', 'admin', 'ok', 1),
      ).rejects.toThrow(ConflictException);
      expect(tx.decisionEmail.create).not.toHaveBeenCalled();
    },
  );
  it.each(['organization', 'user'] as const)(
    'rejects unsuccessful %s update',
    async (model) => {
      tx[model].updateMany.mockResolvedValue({ count: 0 });
      await expect(
        service.approveApplication('app', 'admin', 'ok', 1),
      ).rejects.toThrow(ConflictException);
      expect(tx.decisionEmail.create).not.toHaveBeenCalled();
    },
  );
  it('maps transaction conflicts', async () => {
    tx.$transaction.mockRejectedValue({ code: 'P2034' });
    await expect(
      service.approveApplication('app', 'admin', 'ok', 1),
    ).rejects.toThrow(ConflictException);
  });
});
