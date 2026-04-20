import { Injectable } from '@nestjs/common';
import { type PrismaService } from '../prisma/prisma.service';
import type { HealthResponse } from '@chatrix/shared';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthResponse> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', db: 'ok' };
    } catch {
      return { status: 'error', db: 'error' };
    }
  }
}
