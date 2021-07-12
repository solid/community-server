import type { ResourceIdentifier } from '../../../../src/ldp/representation/ResourceIdentifier';
import { BaseIdentifierStrategy } from '../../../../src/util/identifiers/BaseIdentifierStrategy';

class DummyStrategy extends BaseIdentifierStrategy {
  public supportsIdentifier(identifier: ResourceIdentifier): boolean {
    return !identifier.path.endsWith('unsupported');
  }

  public isRootContainer(identifier: ResourceIdentifier): boolean {
    return identifier.path.endsWith('root');
  }
}

describe('A BaseIdentifierStrategy', (): void => {
  const strategy = new DummyStrategy();

  it('returns the parent identifier.', async(): Promise<void> => {
    expect(strategy.getParentContainer({ path: 'http://test.com/foo/bar' })).toEqual({ path: 'http://test.com/foo/' });
    expect(strategy.getParentContainer({ path: 'http://test.com/foo/bar/' })).toEqual({ path: 'http://test.com/foo/' });
  });

  it('errors when attempting to get the parent of an unsupported identifier.', async(): Promise<void> => {
    expect((): any => strategy.getParentContainer({ path: '/unsupported' }))
      .toThrow('The identifier /unsupported is outside the configured identifier space.');
    expect((): any => strategy.getParentContainer({ path: '/unsupported' }))
      .toThrow(expect.objectContaining({ errorCode: 'E0001', details: { path: '/unsupported' }}));
  });

  it('errors when attempting to get the parent of a root container.', async(): Promise<void> => {
    expect((): any => strategy.getParentContainer({ path: 'http://test.com/root' }))
      .toThrow('Cannot obtain the parent of http://test.com/root because it is a root container.');
  });
});
