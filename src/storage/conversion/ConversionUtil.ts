import type { ValuePreferences } from '../../ldp/representation/RepresentationPreferences';
import { INTERNAL_ALL } from '../../util/ContentTypes';
import { InternalServerError } from '../../util/errors/InternalServerError';
import { NotImplementedHttpError } from '../../util/errors/NotImplementedHttpError';

/**
 * Filters media types based on the given preferences.
 * Based on RFC 7231 - Content negotiation.
 * Will add a default `internal/*;q=0` to the preferences to prevent accidental use of internal types.
 * Since more specific media ranges override less specific ones,
 * this will be ignored if there is a specific internal type preference.
 *
 * @param preferredTypes - Preferences for output type.
 * @param availableTypes - Media types to compare to the preferences.
 *
 * @throws BadRequestHttpError
 * If the type preferences are undefined or if there are duplicate preferences.
 *
 * @returns The weighted and filtered list of matching types.
 */
export function matchingMediaTypes(preferredTypes: ValuePreferences = {}, availableTypes: ValuePreferences = {}):
string[] {
  // No preference means anything is acceptable
  const preferred = { ...preferredTypes };
  if (Object.keys(preferredTypes).length === 0) {
    preferred['*/*'] = 1;
  // Prevent accidental use of internal types
  } else if (!(INTERNAL_ALL in preferred)) {
    preferred[INTERNAL_ALL] = 0;
  }

  // RFC 7231
  //    Media ranges can be overridden by more specific media ranges or
  //    specific media types.  If more than one media range applies to a
  //    given type, the most specific reference has precedence.
  const weightedSupported = Object.entries(availableTypes).map(([ type, quality ]): [string, number] => {
    const match = /^([^/]+)\/([^\s;]+)/u.exec(type);
    if (!match) {
      throw new InternalServerError(`Unexpected type preference: ${type}`);
    }
    const [ , main, sub ] = match;
    const weight =
      preferred[type] ??
      preferred[`${main}/${sub}`] ??
      preferred[`${main}/*`] ??
      preferred['*/*'] ??
      0;
    return [ type, weight * quality ];
  });

  // Return all non-zero preferences in descending order of weight
  return weightedSupported
    .filter(([ , weight ]): boolean => weight !== 0)
    .sort(([ , weightA ], [ , weightB ]): number => weightB - weightA)
    .map(([ type ]): string => type);
}

/**
 * Checks if the pattern matches the media type.
 * Takes wildcards into account.
 * @param type - Media type to match.
 * @param type - Media type to match.
 *
 * @returns True if the pattern matches
 */
export function matchesMediaType(pattern: string, type: string): boolean {
  if (pattern === type) {
    return true;
  }

  const [ patternMain, patternSub ] = pattern.split('/');
  if (patternMain === '*') {
    return true;
  }

  const [ typeMain, typeSub ] = type.split('/');
  if (patternMain !== typeMain) {
    return false;
  }
  if (patternSub === '*') {
    return true;
  }
  return typeSub === patternSub;
}

/**
 * Determines whether the given conversion request is supported,
 * given the available content type conversions:
 *  - Checks if there is a content type for the input.
 *  - Checks if the input type is supported by the parser.
 *  - Checks if the parser can produce one of the preferred output types.
 * Throws an error with details if conversion is not possible.
 * @param inputType - Actual input type.
 * @param outputTypes - Acceptable output types.
 * @param convertorIn - Media types that can be parsed by the converter.
 * @param convertorOut - Media types that can be produced by the converter.
 */
export function supportsMediaTypeConversion(
  inputType = 'unknown', outputTypes: ValuePreferences = {},
  convertorIn: ValuePreferences = {}, convertorOut: ValuePreferences = {},
): void {
  if (!Object.keys(convertorIn).some((type): boolean => matchesMediaType(inputType, type)) ||
     matchingMediaTypes(outputTypes, convertorOut).length === 0) {
    throw new NotImplementedHttpError(
      `Cannot convert from ${inputType} to ${Object.keys(outputTypes)
      }, only from ${Object.keys(convertorIn)} to ${Object.keys(convertorOut)}.`,
    );
  }
}
