import { IsIn, IsString } from 'class-validator';
import { REACTION_EMOJIS } from '@chatrix/shared';

export class ReactRoomMessageDto {
  @IsString() roomId!: string;
  @IsString() messageId!: string;
  @IsIn(REACTION_EMOJIS) emoji!: string;
}
