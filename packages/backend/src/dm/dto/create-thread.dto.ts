import { IsString, IsNotEmpty } from 'class-validator';

export class CreateThreadDto {
  @IsString()
  @IsNotEmpty()
  recipientId!: string;
}
