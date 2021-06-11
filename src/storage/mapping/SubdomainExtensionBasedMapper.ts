import { toASCII, toUnicode } from 'punycode/';
import type { ResourceIdentifier } from '../../ldp/representation/ResourceIdentifier';
import { APPLICATION_TRIG, TEXT_TURTLE } from '../../util/ContentTypes';
import { ForbiddenHttpError } from '../../util/errors/ForbiddenHttpError';
import { InternalServerError } from '../../util/errors/InternalServerError';
import { NotFoundHttpError } from '../../util/errors/NotFoundHttpError';
import {
  decodeUriPathComponents,
  encodeUriPathComponents,
  ensureTrailingSlash,
  createSubdomainRegexp,
  extractScheme,
  trimTrailingSlashes,
} from '../../util/PathUtil';
import { ExtensionBasedMapper } from './ExtensionBasedMapper';

/**
 * Extends the functionality of an {@link ExtensionBasedMapper} to support identifiers containing subdomains.
 * This is mostly only relevant in case you want to support multiple pods with subdomain identifiers
 * in a single ResourceStore.
 *
 * When converting to/from file paths, the subdomain is interpreted as a folder in the rootFilePath.
 * The rest of the path is then interpreted relative to that folder.
 * E.g. `http://alice.test.com/foo` results in the relative path `/alice/foo`.
 *
 * In case there is no subdomain in the URL, the `baseSubdomain` parameter is used instead.
 * E.g., if the `baseSubdomain` is "www", `http://test.com/foo` would result in the relative path `/www/foo`.
 * This means that there is no identifier that maps to the `rootFilePath` itself.
 * To prevent the possibility of 2 identifiers linking to the same file,
 * identifiers containing the default subdomain are rejected.
 * E.g., `http://www.test.com/foo` would result in a 403, even if `http://test.com/foo` exists.
 */
export class SubdomainExtensionBasedMapper extends ExtensionBasedMapper {
  private readonly baseSubdomain: string;
  private readonly regex: RegExp;
  private readonly baseParts: { scheme: string; rest: string };

  public constructor(base: string, rootFilepath: string, baseSubdomain = 'www',
    overrideTypes: Record<string, string> = { acl: TEXT_TURTLE, meta: TEXT_TURTLE, trig: APPLICATION_TRIG }) {
    super(base, rootFilepath, overrideTypes);
    this.baseSubdomain = baseSubdomain;
    this.regex = createSubdomainRegexp(ensureTrailingSlash(base));
    this.baseParts = extractScheme(ensureTrailingSlash(base));
  }

  protected async getContainerUrl(relative: string): Promise<string> {
    return ensureTrailingSlash(this.relativeToUrl(relative));
  }

  protected async getDocumentUrl(relative: string): Promise<string> {
    relative = this.stripExtension(relative);
    return trimTrailingSlashes(this.relativeToUrl(relative));
  }

  /**
   * Converts a relative path to a URL.
   * Examples assuming http://test.com/ is the base url and `www` the base subdomain:
   *  * /www/foo gives http://test.com/foo
   *  * /alice/foo/ gives http://alice.test.com/foo/
   */
  protected relativeToUrl(relative: string): string {
    const match = /^\/([^/]+)\/(.*)$/u.exec(relative);
    if (!Array.isArray(match)) {
      throw new InternalServerError(`Illegal relative path ${relative}`);
    }
    const tail = encodeUriPathComponents(match[2]);
    if (match[1] === this.baseSubdomain) {
      return `${this.baseRequestURI}/${tail}`;
    }
    return `${this.baseParts.scheme}${toASCII(match[1])}.${this.baseParts.rest}${tail}`;
  }

  /**
   * Gets the relative path as though the subdomain url is the base, and then prepends it with the subdomain.
   * Examples assuming http://test.com/ is the base url and `www` the base subdomain:
   *  * http://test.com/foo gives /www/foo
   *  * http://alice.test.com/foo/ gives /alice/foo/
   */
  protected getRelativePath(identifier: ResourceIdentifier): string {
    const match = this.regex.exec(identifier.path);
    if (!Array.isArray(match)) {
      this.logger.warn(`The URL ${identifier.path} is outside of the scope ${this.baseRequestURI}`);
      throw new NotFoundHttpError();
    }
    // Otherwise 2 different identifiers would be able to access the same resource
    if (match[1] === this.baseSubdomain) {
      throw new ForbiddenHttpError(`Subdomain ${this.baseSubdomain} can not be used.`);
    }
    const tail = `/${decodeUriPathComponents(identifier.path.slice(match[0].length))}`;
    const subdomain = match[1] ? toUnicode(match[1]) : this.baseSubdomain;
    return `/${subdomain}${tail}`;
  }
}
