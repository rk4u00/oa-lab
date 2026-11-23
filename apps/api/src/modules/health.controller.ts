import { Controller, Get, Inject } from '@nestjs/common';
import { dockerAvailable } from '@oa-lab/execution-engine';
import { EXECUTION_DRIVER, ExecutionDriver } from '../common/driver.provider';

@Controller('health')
export class HealthController {
  constructor(@Inject(EXECUTION_DRIVER) private readonly driver: ExecutionDriver) {}

  @Get()
  async health() {
    return { ok: true, driver: this.driver.name, docker: this.driver.name === 'docker' ? await dockerAvailable() : null };
  }
}
