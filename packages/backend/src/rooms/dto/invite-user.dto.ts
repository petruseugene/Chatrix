import { IsString } from 'class-validator';

export class InviteUserDto {
  @IsString()
  username!: string;
}
