import type { HttpResponse } from '../../server/HttpResponse';
import { AsyncHandler } from '../../util/handlers/AsyncHandler';
import type { ResponseDescription } from './response/ResponseDescription';

/**
 * Writes to the HttpResponse.
 * Response depends on the operation result and potentially which errors was thrown.
 */
export abstract class ResponseWriter
  extends AsyncHandler<{ response: HttpResponse; result: ResponseDescription | Error }> {}
