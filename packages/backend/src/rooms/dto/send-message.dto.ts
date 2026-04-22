import { IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class SendMessageDto {
  @ValidateIf((o: SendMessageDto) => !o.attachmentId)
  @IsString()
  @MinLength(1)
  @MaxLength(3072)
  content!: string;

  @IsOptional()
  @IsString()
  replyToId?: string;

  @IsOptional()
  @IsString()
  attachmentId?: string;
}
