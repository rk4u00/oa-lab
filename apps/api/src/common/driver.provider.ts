import { createDriver, ExecutionDriver } from '@oa-lab/execution-engine';
import { env } from './env';

export const EXECUTION_DRIVER = Symbol('EXECUTION_DRIVER');
export type { ExecutionDriver };

export const driverProvider = {
  provide: EXECUTION_DRIVER,
  useFactory: () => createDriver(env.driver, env.hostDataDir ? { from: env.dataDir, to: env.hostDataDir } : undefined),
};
