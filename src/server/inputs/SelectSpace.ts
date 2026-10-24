import {Message} from '../../common/logs/Message';
import {Space} from '../boards/Space';
import {InputResponse, isSelectSpaceResponse} from '../../common/inputs/InputResponse';
import {SelectSpaceModel} from '../../common/models/PlayerInputModel';
import {BasePlayerInput} from '../PlayerInput';
import {InputError} from './InputError';
import {toID} from '../../common/utils/utils';
import {TileType} from '../../common/TileType';

export class SelectSpace extends BasePlayerInput<Space> {
  /** The tile the chosen space will get, so the client can show it there before it is placed. */
  public tileType: TileType | undefined;

  constructor(
    title: string | Message,
    public spaces: ReadonlyArray<Space>) {
    super('space', title);
    if (spaces.length === 0) {
      throw new InputError('No available spaces');
    }
  }

  /** Says which tile the chosen space will get. */
  public placing(tileType: TileType): this {
    this.tileType = tileType;
    return this;
  }

  public override toModel(): SelectSpaceModel {
    const model: SelectSpaceModel = {
      title: this.title,
      buttonLabel: this.buttonLabel,
      type: 'space',
      spaces: this.spaces.map(toID),
    };
    if (this.tileType !== undefined) {
      model.tileType = this.tileType;
    }
    return model;
  }

  public process(input: InputResponse) {
    if (!isSelectSpaceResponse(input)) {
      throw new InputError('Not a valid SelectSpaceResponse');
    }
    const space = this.spaces.find((space) => space.id === input.spaceId);
    if (space === undefined) {
      throw new InputError('Space not available');
    }
    return this.cb(space);
  }
}
