import {PartyName} from '@/common/turmoil/PartyName';
import {TurmoilModel} from '@/common/models/TurmoilModel';
import {Agenda} from '@/common/turmoil/Types';

/** The bonus and the policy `party` brings this game, or undefined when the game has none. */
export function partyAgenda(turmoil: TurmoilModel, party: PartyName): Agenda | undefined {
  const politicalAgendas = turmoil.politicalAgendas;
  if (politicalAgendas === undefined) {
    return undefined;
  }
  switch (party) {
  case PartyName.MARS:
    return politicalAgendas.marsFirst;
  case PartyName.SCIENTISTS:
    return politicalAgendas.scientists;
  case PartyName.UNITY:
    return politicalAgendas.unity;
  case PartyName.KELVINISTS:
    return politicalAgendas.kelvinists;
  case PartyName.REDS:
    return politicalAgendas.reds;
  case PartyName.GREENS:
    return politicalAgendas.greens;
  }
}
