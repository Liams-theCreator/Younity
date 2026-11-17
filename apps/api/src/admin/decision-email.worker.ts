import { Injectable, Logger } from '@nestjs/common';
import type { OnModuleInit, OnApplicationShutdown } from '@nestjs/common';
import { DecisionEmailDispatcher } from './decision-email.dispatcher.js';

/** Opt-in delivery avoids sending existing queued mail during ordinary development.
 * Every production replica may run this poller; PostgreSQL owns claim concurrency.
 */
@Injectable()
export class DecisionEmailWorker
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly logger = new Logger(DecisionEmailWorker.name);
  private timer?: ReturnType<typeof setInterval>;
  private running?: Promise<void>;
  private stopping = false;

  constructor(private readonly dispatcher: DecisionEmailDispatcher) {}

  onModuleInit() {
    if (process.env.ADMIN_DECISION_EMAIL_ENABLED !== 'true') return;
    this.timer = setInterval(() => {
      void this.tick();
    }, 5000);
    this.timer.unref();
  }

  tick(): Promise<void> {
    if (this.stopping) return Promise.resolve();
    if (this.running) return this.running;
    this.running = this.drain().finally(() => {
      this.running = undefined;
    });
    return this.running;
  }

  private async drain() {
    try {
      for (let count = 0; count < 20 && !this.stopping; count++) {
        if (!(await this.dispatcher.dispatchOne())) break;
      }
    } catch {
      // Never log raw database/provider errors, which can contain credentials.
      this.logger.error(
        'Decision email queue processing failed; next poll will retry',
      );
    }
  }

  async onApplicationShutdown() {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    await this.running;
  }
}
