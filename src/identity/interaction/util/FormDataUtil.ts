import type { ParsedUrlQuery } from 'querystring';
import { parse } from 'querystring';
import type { HttpRequest } from '../../../server/HttpRequest';
import { UnsupportedMediaTypeHttpError } from '../../../util/errors/UnsupportedMediaTypeHttpError';
import { readableToString } from '../../../util/StreamUtil';

/**
 * Architecturally, this file doesn't make any sense. It simply exists in this form
 * because I'm trying to get a complete product as quickly as possible. In the future
 * we can quibble over exactly how to structure this. I don't care where it
 * goes, as long as I'm able to convert a request into a record without dealing
 * with any of the LDP specific libraries.
 */
export async function getFormDataRequestBody(request: HttpRequest): Promise<ParsedUrlQuery> {
  if (request.headers['content-type'] !== 'application/x-www-form-urlencoded') {
    throw new UnsupportedMediaTypeHttpError();
  }
  const body = await readableToString(request);
  return parse(body);
}