import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SearchRoomsDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  search?: string;

  @IsOptional()
  @IsString()
  cursor?: string;
}
