import { IsString, MinLength, MaxLength } from 'class-validator';

export class InviteUserDto {
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  username!: string;
}
