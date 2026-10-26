import {UNIT_LABELS, entryResponse, questionAt} from '@/client/components/mobile/PickSheet';
import {InputResponse} from '@/common/inputs/InputResponse';
import {Message} from '@/common/logs/Message';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {Units} from '@/common/Units';

/** One line of the units sheet: a number from `min` to `max`, set with − and +. */
export type UnitsRow = {
  label: string | Message;
  /** The standard resource the row is about, for its icon, or undefined. */
  resource: keyof Units | undefined;
  /** What the player has of it now, shown beside the label, or undefined. */
  have: number | undefined;
  min: number;
  max: number;
  /** Where the row starts. */
  start: number;
};

/** A question answered with a number on each of several rows. */
export type UnitsQuestion = {
  title: string | Message;
  buttonLabel: string;
  optional: boolean;
  rows: ReadonlyArray<UnitsRow>;
  /** What the rows must add up to, when the server says; otherwise each row stands alone. */
  total: number | undefined;
  /** The answer that sends `values`, one for each row. */
  respond: (values: ReadonlyArray<number>) => InputResponse;
};

function asUnits(values: ReadonlyArray<number>, keys: ReadonlyArray<keyof Units>): Units {
  const units: Units = {...Units.EMPTY};
  keys.forEach((key, index) => {
    units[key] = values[index] ?? 0;
  });
  return units;
}

/**
 * `input` as rows of numbers, when it is one of the questions the units sheet asks:
 * several numbers at once (resources spread over cards, Stormcraft's heat and
 * floaters), standard resources to gain up to a count, or production to lose.
 */
export function unitsFor(input: PlayerInputModel | undefined): UnitsQuestion | undefined {
  switch (input?.type) {
  case 'and': {
    const amounts = input.options.flatMap((option) => option.type === 'amount' ? [option] : []);
    if (amounts.length === 0 || amounts.length !== input.options.length) {
      return undefined;
    }
    return {
      // `AndOptions` has no title of its own unless the card gives it one.
      title: input.title === '' ? 'Choose the amounts' : input.title,
      buttonLabel: input.buttonLabel,
      optional: input.optional === true,
      rows: amounts.map((amount) => ({
        label: amount.title,
        resource: undefined,
        have: undefined,
        min: amount.min,
        max: amount.max,
        start: amount.maxByDefault ? amount.max : amount.min,
      })),
      total: undefined,
      respond: (values) => ({type: 'and', responses: values.map((amount) => ({type: 'amount', amount}))}),
    };
  }
  case 'resources':
    return {
      title: input.title,
      buttonLabel: input.buttonLabel,
      optional: input.optional === true,
      rows: Units.keys.map((key) => ({label: UNIT_LABELS[key], resource: key, have: undefined, min: 0, max: input.count, start: 0})),
      total: input.count,
      respond: (values) => ({type: 'resources', units: asUnits(values, Units.keys)}),
    };
  case 'productionToLose': {
    const production = input.payProduction.units;
    // M€ production may go down to -5; every other kind only to 0.
    const spare = (key: keyof Units) => key === 'megacredits' ? production[key] + 5 : production[key];
    const keys = Units.keys.filter((key) => spare(key) > 0);
    return {
      title: input.title,
      buttonLabel: input.buttonLabel,
      optional: input.optional === true,
      rows: keys.map((key) => ({label: UNIT_LABELS[key], resource: key, have: production[key], min: 0, max: spare(key), start: 0})),
      total: input.payProduction.cost,
      respond: (values) => ({type: 'productionToLose', units: asUnits(values, keys)}),
    };
  }
  default:
    return undefined;
  }
}

/**
 * The units question at option `entry` of the choice the player is waiting on, or
 * with no entry, the question itself -- its answer sent as that option's.
 */
export function unitsQuestion(waitingFor: PlayerInputModel | undefined, entry?: number): UnitsQuestion | undefined {
  const question = unitsFor(questionAt(waitingFor, entry));
  if (question === undefined) {
    return undefined;
  }
  return {...question, respond: (values) => entryResponse(entry, question.respond(values))};
}
