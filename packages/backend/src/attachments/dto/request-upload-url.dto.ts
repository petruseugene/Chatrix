import { IsIn, IsInt, IsString, MaxLength, Min, Max } from 'class-validator';

export class RequestUploadUrlDto {
  @IsIn(['ROOM', 'DM'])
  targetType!: 'ROOM' | 'DM';

  @IsString()
  targetId!: string;

  @IsString()
  @MaxLength(255)
  filename!: string;

  @IsString()
  mimeType!: string;

  @IsInt()
  @Min(1)
  @Max(20 * 1024 * 1024)
  size!: number;
}
