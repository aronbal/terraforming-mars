import {LogMessageBuilder} from './LogMessageBuilder';
import {IPlayer} from '../IPlayer';

export type LogOptions = {
  /** When set, the message is private to this player. */
  reservedFor?: IPlayer,
  /**
   * When set, the message reports an action this player is taking.
   *
   * Effects of that action are attached to it until the next such message or the end of the action.
   * See `IGame.logEffect`.
   */
  actor?: IPlayer,
};

export interface Logger {
  log(message: string, f?: (builder: LogMessageBuilder) => void, options?: LogOptions): void;
}
