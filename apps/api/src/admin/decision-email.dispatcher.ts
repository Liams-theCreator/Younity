import { randomUUID } from 'node:crypto';
import type { PrismaService } from '../prisma/prisma.service.js';

// The shared S2-01 MailService implements this delivery contract.
// A stable messageId mitigates duplicates; providers should deduplicate by it.
export interface DecisionEmailSender {
  sendDecisionEmail(input: {
    recipient: string;
    status: string;
    reason: string;
    messageId: string;
  }): Promise<void>;
}

export class DecisionEmailDispatcher {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sender: DecisionEmailSender,
  ) {}

  async dispatchOne(now = new Date()): Promise<boolean> {
    const token = randomUUID();
    const item = await this.prisma.$transaction(async (tx) => {
      // An attempt that crashes on the final lease must become observable and
      // terminal rather than remaining SENDING forever.
      await tx.decisionEmail.updateMany({
        where: {
          status: 'SENDING',
          attempts: { gte: 5 },
          claimedUntil: { lte: now },
        },
        data: {
          status: 'EXHAUSTED',
          lastError: 'Final delivery lease expired; delivery outcome unknown',
          claimToken: null,
          claimedUntil: null,
        },
      });
      // SKIP LOCKED allows multiple dispatchers without claiming the same row.
      const rows = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM decision_emails
        WHERE status IN ('PENDING', 'FAILED', 'SENDING') AND attempts < 5
          AND next_attempt_at <= ${now}
          AND (claimed_until IS NULL OR claimed_until <= ${now})
        ORDER BY created_at, id FOR UPDATE SKIP LOCKED LIMIT 1`;
      if (!rows[0]) return null;
      return tx.decisionEmail.update({
        where: { id: rows[0].id },
        data: {
          status: 'SENDING',
          claimToken: token,
          claimedUntil: new Date(now.getTime() + 300_000),
          attempts: { increment: 1 },
        },
        include: { decision: true },
      });
    });
    if (!item) return false;
    // SMTP cannot guarantee exactly-once after a crash. A sender must finish within
    // the five-minute lease (shared SMTP timeouts are much shorter).
    try {
      await this.sender.sendDecisionEmail({
        recipient: item.recipient,
        status: item.decision.newStatus,
        reason: item.decision.reason,
        messageId: `<decision-${item.decisionId}@younity.test>`,
      });
    } catch {
      await this.prisma.decisionEmail.updateMany({
        where: { id: item.id, claimToken: token },
        data: {
          status: item.attempts >= 5 ? 'EXHAUSTED' : 'FAILED',
          lastError: 'Decision email delivery failed',
          claimToken: null,
          claimedUntil: null,
          nextAttemptAt: new Date(
            now.getTime() + 60_000 * 2 ** (item.attempts - 1),
          ),
        },
      });
      return true;
    }
    await this.prisma.decisionEmail.updateMany({
      where: { id: item.id, claimToken: token },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        lastError: null,
        claimToken: null,
        claimedUntil: null,
      },
    });
    return true;
  }
}
