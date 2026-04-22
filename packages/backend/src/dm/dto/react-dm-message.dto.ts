import { IsIn, IsString } from 'class-validator';
import { REACTION_EMOJIS } from '@chatrix/shared';

export class ReactDmMessageDto {
  @IsString() threadId!: string;
  @IsString() messageId!: string;
  @IsIn(REACTION_EMOJIS) emoji!: string;
}
