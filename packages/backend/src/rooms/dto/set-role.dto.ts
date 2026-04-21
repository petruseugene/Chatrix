import { IsIn } from 'class-validator';

export class SetRoleDto {
  @IsIn(['ADMIN', 'MEMBER'])
  role!: 'ADMIN' | 'MEMBER';
}
