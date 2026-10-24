import {$t, translateMessage, translateTextWithParams} from '@/client/directives/i18n';
import {AwardName} from '@/common/ma/AwardName';
import {Color} from '@/common/Color';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {Message} from '@/common/logs/Message';
import {MADetail} from '@/common/game/VictoryPointsBreakdown';

/** A milestone's line in the points breakdown, translated. */
export function translateMilestoneDetails(data: MADetail): string {
  const args = (data.messageArgs || []).map($t);
  return translateTextWithParams(data.message, args);
}

/** An award's line in the points breakdown, translated: place, award, and who funded it. */
export function translateAwardDetails(data: MADetail): string {
  if ( ! data.messageArgs || data.messageArgs.length < 3) {
    console.error( // data.message: ${0} place for ${1} award (funded by ${2})
      `Award detail has not enought data.
      It must contain at least 3 arguments:
      1) a Player's place in the race for the award
      2) translatable Award name
      3) not translatable Player name
      `,
    );
    return translateMilestoneDetails(data);
  }
  const message: Message = {
    message: data.message,
    data: [
      {
        type: LogMessageDataType.STRING,
        value: data.messageArgs[0],
      },
      {
        type: LogMessageDataType.AWARD,
        value: data.messageArgs[1] as AwardName,
      },
      {
        type: LogMessageDataType.PLAYER,
        value: data.messageArgs[2] as Color,
      },
    ],
  };
  return translateMessage(message);
}
