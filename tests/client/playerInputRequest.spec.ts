import {expect} from 'chai';
import {CANNOT_CONTACT_SERVER, isServerUnavailable, postPlayerInput} from '@/client/utils/playerInputRequest';
import {fakePlayerViewModel} from './components/testHelpers';

describe('playerInputRequest', () => {
  let realFetch: typeof global.fetch;
  let status: number;
  let alerts: Array<[string, string]>;
  let component: {$root: unknown};

  beforeEach(() => {
    realFetch = global.fetch;
    alerts = [];
    component = {
      $root: {
        isServerSideRequestInProgress: false,
        showAlert: (title: string, message: string) => alerts.push([title, message]),
      },
    };
    global.fetch = (async () => ({ok: false, status, statusText: '', json: async () => ({})})) as unknown as typeof global.fetch;
  });

  afterEach(() => {
    global.fetch = realFetch;
  });

  it('knows the host standing in for a server that is down or restarting', () => {
    expect([502, 503, 504].every(isServerUnavailable)).is.true;
    expect([400, 404, 500].some(isServerUnavailable)).is.false;
  });

  it('says the server is restarting rather than that its answer was odd', async () => {
    status = 502;
    expect(await postPlayerInput(component as never, fakePlayerViewModel(), {type: 'option'})).is.false;
    expect(alerts).deep.eq([['Error sending input,', CANNOT_CONTACT_SERVER]]);
  });

  it('names the status of any other unexpected answer', async () => {
    status = 500;
    await postPlayerInput(component as never, fakePlayerViewModel(), {type: 'option'});
    expect(alerts[0][1]).contains('(500)');
  });
});
