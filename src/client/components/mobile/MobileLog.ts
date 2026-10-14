import {paths} from '@/common/app/paths';
import {Color} from '@/common/Color';
import {Log} from '@/common/logs/Log';
import {LogMessage} from '@/common/logs/LogMessage';
import {LogMessageData} from '@/common/logs/LogMessageData';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {LogMessageType} from '@/common/logs/LogMessageType';
import {ParticipantId} from '@/common/Types';
import {tileTypeToString} from '@/common/TileType';
import {getSpaceName} from '@/common/boards/spaces';
import {summarizeLogEffects} from '@/common/logs/logEffects';
import {undergroundResourceTokenDescription} from '@/common/underworld/UndergroundResourceToken';
import {MobileIconName} from '@/client/components/mobile/MobileIcons';

/*
 * The game log as the mobile shell reads it: one row per line, saying who did what
 * and when.
 *
 * The desktop log draws each line as a sentence with the player's name, the cards and
 * the spaces as coloured chips inside it. A phone row has room for a title and a line
 * under it, so the acting player moves out of the sentence -- into the glyph's colour
 * and the subtitle -- and the rest of the sentence becomes the title: `Mette played
 * Comet` reads `Played Comet`, by Mette.
 */

/** One line of the log, ready to draw as a row. */
export type LogEvent = {
  /** Stable within one generation's log, for the list's keys. */
  key: string;
  generation: number;
  /** The sentence, without the player who acted when the sentence starts with them. */
  title: string;
  /** The player the line is about, when it is about one. */
  color: Color | undefined;
  icon: MobileIconName;
  timestamp: number;
  /** Whether only this player can see the line (what they drew, for instance). */
  private: boolean;
  /** What the action changed on Mars, when the server recorded it: `+1 temp · ocean`. */
  effects: string | undefined;
};

/** What a row needs to know about the players to name them. */
export type LogPlayer = {
  color: Color;
  name: string;
};

type Translate = (text: string) => string;

/*
 * Which glyph a line gets, from the untranslated sentence. The server's sentences are
 * the stable part of a log line -- the data inside them changes, the wording does not
 * -- and the first pattern that matches wins.
 */
const ICON_RULES: ReadonlyArray<{pattern: RegExp, icon: MobileIconName}> = [
  {pattern: /\bpassed\b/i, icon: 'skip-forward'},
  {pattern: /\bclaimed\b/i, icon: 'trophy'},
  {pattern: /\bfunded\b/i, icon: 'award'},
  {pattern: /\baction\b/i, icon: 'zap'},
  {pattern: /\bplayed\b/i, icon: 'layers'},
  {pattern: /\bstandard project\b/i, icon: 'hammer'},
  {pattern: /\btrade/i, icon: 'handshake'},
  {pattern: /\bdelegate|\bparty\b|\bchairman\b/i, icon: 'landmark'},
  {pattern: /\bgreenery\b|\bplants?\b/i, icon: 'leaf'},
  {pattern: /\btemperature\b|\bheat\b/i, icon: 'thermometer'},
  {pattern: /\bocean|\boxygen\b|\bvenus\b/i, icon: 'globe'},
  {pattern: /\bcity\b/i, icon: 'building-2'},
  {pattern: /\bcards?\b|\bdrew\b|\bbought\b/i, icon: 'layers'},
];

export function iconFor(message: string): MobileIconName {
  return ICON_RULES.find((rule) => rule.pattern.test(message))?.icon ?? 'ellipsis';
}

function cardLabel(name: string, translate: Translate): string {
  // Some card names carry a suffix after a colon to tell variants apart.
  return translate(name.split(':')[0]);
}

function dataText(datum: LogMessageData | undefined, players: ReadonlyArray<LogPlayer>, translate: Translate): string {
  if (datum === undefined) {
    return '';
  }
  switch (datum.type) {
  case LogMessageDataType.PLAYER:
    return players.find((player) => player.color === datum.value)?.name ?? datum.value;
  case LogMessageDataType.CARD:
    return cardLabel(datum.value, translate);
  case LogMessageDataType.CARDS:
    return datum.attrs?.ellipsis ? '…' : datum.value.map((name) => cardLabel(name, translate)).join(', ');
  case LogMessageDataType.TILE_TYPE:
    return translate(tileTypeToString[datum.value]);
  case LogMessageDataType.SPACE:
    return getSpaceName(datum.value);
  case LogMessageDataType.UNDERGROUND_TOKEN:
    return translate(undergroundResourceTokenDescription[datum.value]);
  case LogMessageDataType.RAW_STRING:
    return datum.value;
  default:
    return translate(String(datum.value));
  }
}

/** The player a line starts with, which is the one who acted. */
export function actorOf(message: LogMessage): Color | undefined {
  const first = message.data[0];
  if (!message.message.startsWith('${0}') || first?.type !== LogMessageDataType.PLAYER) {
    return undefined;
  }
  return first.value;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The sentence a line says, with the acting player taken out when it starts with one. */
export function titleOf(message: LogMessage, players: ReadonlyArray<LogPlayer>, translate: Translate): string {
  const translated = {message: translate(message.message), data: message.data};
  const parts = Log.parse(translated);
  const actor = actorOf(message);
  /* Translations may move the player, so only the untranslated sentence's leading
     player is dropped, and only when the translation still leads with them. */
  const dropFirst = actor !== undefined && translated.message.startsWith('${0}');
  const text = parts
    .slice(dropFirst ? 1 : 0)
    .map((part) => typeof part === 'string' ? part : dataText(part, players, translate))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
  return capitalize(text);
}

export function toEvent(
  message: LogMessage,
  generation: number,
  index: number,
  players: ReadonlyArray<LogPlayer>,
  translate: Translate): LogEvent {
  return {
    key: generation + ':' + index,
    generation,
    title: titleOf(message, players, translate),
    color: actorOf(message),
    icon: iconFor(message.message),
    timestamp: message.timestamp,
    private: message.playerId !== undefined,
    effects: summarizeLogEffects(message.effects),
  };
}

/** Whether a line is worth a row: the generation headings are drawn as headings instead. */
export function isEventLine(message: LogMessage): boolean {
  return message.type !== LogMessageType.NEW_GENERATION &&
    message.message !== undefined &&
    message.data !== undefined;
}

/**
 * How long ago something happened, as short as a row's subtitle needs: `now`,
 * `4 min`, `2 h`, `3 d`.
 */
export function formatAgo(timestamp: number, now: number): string {
  const minutes = Math.floor(Math.max(0, now - timestamp) / 60000);
  if (minutes < 1) {
    return 'now';
  }
  if (minutes < 60) {
    return minutes + ' min';
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return hours + ' h';
  }
  return Math.floor(hours / 24) + ' d';
}

/**
 * What other players did since this player last acted, newest first.
 *
 * `events` is the log oldest first, as the server sends it. The player's own last line
 * is the cut: everything after it that another player did is what they have missed.
 * If they have not acted in the lines at hand, all of them count.
 */
export function sinceLastTurn(events: ReadonlyArray<LogEvent>, me: Color): ReadonlyArray<LogEvent> {
  let start = 0;
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].color === me) {
      start = i + 1;
      break;
    }
  }
  return events
    .slice(start)
    .filter((event) => event.color !== undefined && event.color !== me)
    .reverse();
}

/**
 * Fetches one generation's log.
 *
 * Not `fetchLogs`: that one cancels whatever request came before it, which is right
 * for a panel showing one generation at a time and wrong for a list that reads two at
 * once.
 */
export async function fetchGenerationLog(id: ParticipantId, generation: number): Promise<Array<LogMessage> | undefined> {
  try {
    const response = await fetch(`${paths.API_GAME_LOGS}?id=${id}&generation=${generation}`);
    if (!response.ok) {
      console.error(`error fetching the log, response code ${response.status}`);
      return undefined;
    }
    return await response.json();
  } catch (err) {
    console.error('error fetching the log, unable to reach server');
    return undefined;
  }
}
