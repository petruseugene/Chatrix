import { Controller, Post, Get, Param, Body, UseGuards, HttpCode } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '@chatrix/shared';
import { AttachmentsService } from './attachments.service';
import { RequestUploadUrlDto } from './dto/request-upload-url.dto';

@UseGuards(JwtAuthGuard)
@Controller('attachments')
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  // POST /attachments/upload-url
  @Post('upload-url')
  @HttpCode(201)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async requestUploadUrl(@CurrentUser() user: JwtPayload, @Body() dto: RequestUploadUrlDto) {
    return this.attachmentsService.requestUploadUrl(user.sub, {
      targetType: dto.targetType,
      ...(dto.targetType === 'ROOM' ? { roomId: dto.targetId } : { dmThreadId: dto.targetId }),
      originalFilename: dto.filename,
      mimeType: dto.mimeType,
      size: dto.size,
    });
  }

  // POST /attachments/:id/commit
  @Post(':id/commit')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async commitUpload(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.attachmentsService.commitUpload(user.sub, id);
  }

  // GET /attachments/:id/download
  @Get(':id/download')
  @Throttle({ default: { limit: 100, ttl: 60_000 } })
  async getDownloadUrl(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.attachmentsService.getDownloadUrl(user.sub, id);
  }
}
