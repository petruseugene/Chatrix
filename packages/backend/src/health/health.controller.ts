import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import type { HealthResponse } from '@chatrix/shared';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async check(): Promise<HealthResponse> {
    const result = await this.healthService.check();
    if (result.status !== 'ok') {
      throw new HttpException(result, HttpStatus.SERVICE_UNAVAILABLE);
    }
    return result;
  }
}
