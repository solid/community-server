import type { Provider } from 'oidc-provider';
import {
  OidcInteractionCompleter,
} from '../../../../../src/identity/interaction/util/OidcInteractionCompleter';
import type { HttpRequest } from '../../../../../src/server/HttpRequest';
import type { HttpResponse } from '../../../../../src/server/HttpResponse';

describe('OidcInteractionCompleter', (): void => {
  const request: HttpRequest = 'request!' as any;
  const response: HttpResponse = 'response!' as any;
  const webId = 'http://alice.test.com/#me';
  let provider: Provider;
  const completer = new OidcInteractionCompleter();

  beforeEach(async(): Promise<void> => {
    provider = {
      interactionFinished: jest.fn(),
    } as any;
  });

  it('sends the correct data to the provider.', async(): Promise<void> => {
    await expect(completer.handle({ request, response, provider, webId, shouldRemember: true }))
      .resolves.toBeUndefined();
    expect(provider.interactionFinished).toHaveBeenCalledTimes(1);
    expect(provider.interactionFinished).toHaveBeenLastCalledWith(request, response, {
      login: {
        account: webId,
        remember: true,
        ts: Math.floor(Date.now() / 1000),
      },
      consent: {
        rejectedScopes: [],
      },
    });
  });

  it('rejects offline access if shouldRemember is false.', async(): Promise<void> => {
    await expect(completer.handle({ request, response, provider, webId, shouldRemember: false }))
      .resolves.toBeUndefined();
    expect(provider.interactionFinished).toHaveBeenCalledTimes(1);
    expect(provider.interactionFinished).toHaveBeenLastCalledWith(request, response, {
      login: {
        account: webId,
        remember: false,
        ts: Math.floor(Date.now() / 1000),
      },
      consent: {
        rejectedScopes: [ 'offline_access' ],
      },
    });
  });
});