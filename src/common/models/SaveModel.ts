import {Color} from '../Color';
import {LogMessage} from '../logs/LogMessage';

/**
 * One of a game's earlier saves, as the game master picks one to go back to.
 */
export type SaveModel = {
  saveId: number;
  generation: number;
  /** Whose move the game waits on at this save. */
  activePlayer: Color | undefined;
  /**
   * The last lines logged up to this save, oldest first: what was done just before
   * it, and so what going back to it keeps. Lines private to another player are left out.
   */
  log: ReadonlyArray<LogMessage>;
};
