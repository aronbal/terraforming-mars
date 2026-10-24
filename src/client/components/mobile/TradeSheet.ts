import {entryFor, isActionMenu} from '@/client/components/mobile/MobileActionMenu';
import {ColonyName} from '@/common/colonies/ColonyName';
import {InputResponse} from '@/common/inputs/InputResponse';
import {Message} from '@/common/logs/Message';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';

/**
 * Where the parts of the turn's trade entry sit, for one colony it offers.
 *
 * The server sends a trade as an `and` of two questions -- how to pay the fee, and
 * which tile -- and wants both answered together, each at its own place.
 */
export type TradePlan = {
  /** The trade entry's place in the turn's menu. */
  index: number;
  /** The place of the fee question in the `and`. */
  feePart: number;
  /** The place of the tile question in the `and`. */
  colonyPart: number;
  /** The ways to pay the fee, in the server's words and order. */
  fees: ReadonlyArray<string | Message>;
};

/** How the turn's menu would trade with `colony`, or undefined if it does not offer it. */
export function tradePlan(waitingFor: PlayerInputModel | undefined, colony: string): TradePlan | undefined {
  const entry = entryFor(isActionMenu(waitingFor) ? waitingFor : undefined, 'tradeWithColony');
  const input = entry?.input;
  if (entry === undefined || input?.type !== 'and') {
    return undefined;
  }
  const feePart = input.options.findIndex((option) => option.type === 'or');
  const colonyPart = input.options.findIndex((option) => option.type === 'colony');
  const fee = input.options[feePart];
  const tiles = input.options[colonyPart];
  if (fee?.type !== 'or' || tiles?.type !== 'colony' || fee.options.length === 0) {
    return undefined;
  }
  if (!tiles.coloniesModel.some((each) => each.name === colony)) {
    return undefined;
  }
  return {index: entry.index, feePart, colonyPart, fees: fee.options.map((option) => option.title)};
}

/** The answer that trades with `colony`, paying with the fee at `feeIndex`. */
export function tradeResponse(plan: TradePlan, feeIndex: number, colony: ColonyName): InputResponse {
  const responses: Array<InputResponse> = [];
  responses[plan.feePart] = {type: 'or', index: feeIndex, response: {type: 'option'}};
  responses[plan.colonyPart] = {type: 'colony', colonyName: colony};
  return {type: 'or', index: plan.index, response: {type: 'and', responses}};
}
