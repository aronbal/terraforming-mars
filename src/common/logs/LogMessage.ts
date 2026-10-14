import {LogMessageType} from './LogMessageType';
import {LogMessageData} from './LogMessageData';
import {Message} from './Message';
import {PlayerId} from '../Types';
import {LogEffect} from './LogEffect';

export class LogMessage implements Message {
  public playerId?: PlayerId;
  public timestamp = Date.now();
  public type?: LogMessageType;
  /**
   * Structured effects of the player action this message reports.
   *
   * Only set when there is at least one effect, and absent from messages saved before it existed.
   */
  public effects?: Array<LogEffect>;
  constructor(
    type: LogMessageType,
    public message: string,
    public data: Array<LogMessageData>,
    // When set, this message is private for the specifed player.
    // Always filter messages so they're not sent to the wrong player.
    playerId?: PlayerId) {
    // setting in body to avoid setting property when
    // argument is undefined for less memory usage
    if (playerId !== undefined) {
      this.playerId = playerId;
    }
    // only store property if not default
    // for less memory usage. majority
    // of messages are default
    if (type !== LogMessageType.DEFAULT) {
      this.type = type;
    }
  }
}

