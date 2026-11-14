import { afterEach, describe, expect, it, vi } from 'vitest';
import { DecisionEmailWorker } from './decision-email.worker.js';
import type { DecisionEmailDispatcher } from './decision-email.dispatcher.js';

function worker(dispatchOne = vi.fn().mockResolvedValue(false)) {
  return {
    dispatchOne,
    worker: new DecisionEmailWorker({
      dispatchOne,
    } as unknown as DecisionEmailDispatcher),
  };
}
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
describe('DecisionEmailWorker', () => {
  it('does not start delivering without explicit configuration', async () => {
    vi.useFakeTimers();
    vi.stubEnv('ADMIN_DECISION_EMAIL_ENABLED', 'false');
    const w = worker();
    w.worker.onModuleInit();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(w.dispatchOne).not.toHaveBeenCalled();
    await w.worker.onApplicationShutdown();
  });
  it('polls when enabled and stops cleanly on shutdown', async () => {
    vi.useFakeTimers();
    vi.stubEnv('ADMIN_DECISION_EMAIL_ENABLED', 'true');
    const w = worker();
    w.worker.onModuleInit();
    await vi.advanceTimersByTimeAsync(5000);
    expect(w.dispatchOne).toHaveBeenCalledTimes(1);
    await w.worker.onApplicationShutdown();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(w.dispatchOne).toHaveBeenCalledTimes(1);
  });
  it('does not overlap polls and waits for an in-flight send on shutdown', async () => {
    let resolve!: (value: boolean) => void;
    const send = vi.fn().mockImplementation(
      () =>
        new Promise<boolean>((done) => {
          resolve = done;
        }),
    );
    const w = worker(send);
    const first = w.worker.tick();
    expect(w.worker.tick()).toBe(first);
    expect(send).toHaveBeenCalledTimes(1);
    let stopped = false;
    const shutdown = w.worker.onApplicationShutdown().then(() => {
      stopped = true;
    });
    await Promise.resolve();
    expect(stopped).toBe(false);
    resolve(true);
    await shutdown;
    expect(send).toHaveBeenCalledTimes(1);
  });
  it('bounds each poll so backlog cannot monopolize the process', async () => {
    const w = worker(vi.fn().mockResolvedValue(true));
    await w.worker.tick();
    expect(w.dispatchOne).toHaveBeenCalledTimes(20);
    await w.worker.onApplicationShutdown();
  });
});
