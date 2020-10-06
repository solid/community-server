import streamifyArray from 'streamify-array';
import { UnsupportedHttpError } from '../../../src/util/errors/UnsupportedHttpError';
import { ensureTrailingSlash, matchingMediaType, readableToString, toCanonicalUrl } from '../../../src/util/Util';

describe('Util function', (): void => {
  describe('ensureTrailingSlash', (): void => {
    it('makes sure there is always exactly 1 slash.', async(): Promise<void> => {
      expect(ensureTrailingSlash('http://test.com')).toEqual('http://test.com/');
      expect(ensureTrailingSlash('http://test.com/')).toEqual('http://test.com/');
      expect(ensureTrailingSlash('http://test.com//')).toEqual('http://test.com/');
      expect(ensureTrailingSlash('http://test.com///')).toEqual('http://test.com/');
    });
  });

  describe('readableToString', (): void => {
    it('concatenates all elements of a Readable.', async(): Promise<void> => {
      const stream = streamifyArray([ 'a', 'b', 'c' ]);
      await expect(readableToString(stream)).resolves.toEqual('abc');
    });
  });

  describe('matchingMediaType', (): void => {
    it('matches all possible media types.', async(): Promise<void> => {
      expect(matchingMediaType('*/*', 'text/turtle')).toBeTruthy();
      expect(matchingMediaType('text/*', '*/*')).toBeTruthy();
      expect(matchingMediaType('text/*', 'text/turtle')).toBeTruthy();
      expect(matchingMediaType('text/plain', 'text/*')).toBeTruthy();
      expect(matchingMediaType('text/turtle', 'text/turtle')).toBeTruthy();

      expect(matchingMediaType('text/*', 'application/*')).toBeFalsy();
      expect(matchingMediaType('text/plain', 'application/*')).toBeFalsy();
      expect(matchingMediaType('text/plain', 'text/turtle')).toBeFalsy();
    });
  });

  describe('toCanonicalUrl', (): void => {
    it('makes sure only the necessary parts are encoded.', async(): Promise<void> => {
      expect(toCanonicalUrl('http://test.com/a%20path%26/name'))
        .toEqual('http://test.com/a%20path&/name');
    });

    it('errors on invalid URLs.', async(): Promise<void> => {
      expect((): any => toCanonicalUrl('notAnUrl')).toThrow(new UnsupportedHttpError('Invalid URL notAnUrl'));
    });
  });
});
