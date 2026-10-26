import {ColorWithNeutral} from '@/common/Color';
import {InputResponse} from '@/common/inputs/InputResponse';
import {Message} from '@/common/logs/Message';
import {PlayerInputModel, SelectColonyModel, SelectPartyModel} from '@/common/models/PlayerInputModel';
import {Units} from '@/common/Units';

/** What a standard resource is called on a row. */
export const UNIT_LABELS: Readonly<Record<keyof Units, string>> = {
  megacredits: 'M€',
  steel: 'Steel',
  titanium: 'Titanium',
  plants: 'Plants',
  energy: 'Energy',
  heat: 'Heat',
};

/** Option `entry` of the choice the player is waiting on, or with no entry, the question itself. */
export function questionAt(waitingFor: PlayerInputModel | undefined, entry: number | undefined): PlayerInputModel | undefined {
  return entry === undefined ? waitingFor : (waitingFor?.type === 'or' ? waitingFor.options[entry] : undefined);
}

/** The party a delegate is being sent to, when that is the question at `entry`. */
export function partyInput(waitingFor: PlayerInputModel | undefined, entry?: number): SelectPartyModel | undefined {
  const input = questionAt(waitingFor, entry);
  return input?.type === 'party' ? input : undefined;
}

/** The colony to build on, when that is the question at `entry`. */
export function colonyInput(waitingFor: PlayerInputModel | undefined, entry?: number): SelectColonyModel | undefined {
  const input = questionAt(waitingFor, entry);
  return input?.type === 'colony' ? input : undefined;
}

/** `response`, sent as option `entry` of the choice when there is one. */
export function entryResponse(entry: number | undefined, response: InputResponse): InputResponse {
  return entry === undefined ? response : {type: 'or', index: entry, response};
}

/** One row of the pick sheet: a standard resource, or whose delegate. */
export type PickRow = {
  label: string;
  /** The resource the row stands for, for its icon. */
  resource?: keyof Units;
  /** The delegate's colour, for its dot. */
  color?: ColorWithNeutral;
};

/** A question answered with one row out of a short list. */
export type PickQuestion = {
  title: string | Message;
  buttonLabel: string;
  optional: boolean;
  rows: ReadonlyArray<PickRow>;
  /** The answer that sends row `index`. */
  respond: (index: number) => InputResponse;
};

/**
 * `input` as a list to pick one row from, when it is a standard resource to gain or
 * the delegate to remove. `players` names the delegates by their owners.
 */
export function pickFor(input: PlayerInputModel | undefined, players: ReadonlyArray<{color: ColorWithNeutral, name: string}>): PickQuestion | undefined {
  switch (input?.type) {
  case 'resource':
    return {
      title: input.title,
      buttonLabel: input.buttonLabel,
      optional: input.optional === true,
      rows: input.include.map((resource) => ({label: UNIT_LABELS[resource], resource})),
      respond: (index) => ({type: 'resource', resource: input.include[index]}),
    };
  case 'delegate':
    return {
      title: input.title,
      buttonLabel: input.buttonLabel,
      optional: input.optional === true,
      rows: input.players.map((color) => ({
        label: color === 'NEUTRAL' ? 'Neutral' : players.find((player) => player.color === color)?.name ?? color,
        color,
      })),
      respond: (index) => ({type: 'delegate', player: input.players[index]}),
    };
  default:
    return undefined;
  }
}

/** The pick question at option `entry` of the choice, or the question itself, answered as that option. */
export function pickQuestion(
  waitingFor: PlayerInputModel | undefined,
  players: ReadonlyArray<{color: ColorWithNeutral, name: string}>,
  entry?: number): PickQuestion | undefined {
  const question = pickFor(questionAt(waitingFor, entry), players);
  if (question === undefined) {
    return undefined;
  }
  return {...question, respond: (index) => entryResponse(entry, question.respond(index))};
}
