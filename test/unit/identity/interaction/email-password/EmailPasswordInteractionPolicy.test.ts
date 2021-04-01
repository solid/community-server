import {
  EmailPasswordInteractionPolicy,
} from '../../../../../src/identity/interaction/email-password/EmailPasswordInteractionPolicy';

describe('An EmailPasswordInteractionPolicy', (): void => {
  const idpPathName = 'idp';
  const interactionPolicy = new EmailPasswordInteractionPolicy(idpPathName);

  it('has a select_account policy at index 0.', async(): Promise<void> => {
    expect(interactionPolicy.policy[0].name).toBe('select_account');
  });

  it('creates URLs by prepending /idp/interaction/.', async(): Promise<void> => {
    expect(interactionPolicy.url({ oidc: { uid: 'valid-uid' }} as any)).toBe('/idp/interaction/valid-uid');
  });
});
