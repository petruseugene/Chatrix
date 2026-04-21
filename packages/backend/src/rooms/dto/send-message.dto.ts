import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(3072)
  content!: string;

  @IsOptional()
  @IsString()
  replyToId?: string;
}
