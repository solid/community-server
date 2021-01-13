import { AsyncHandler } from '../util/handlers/AsyncHandler';
import type { HttpRequest } from './HttpRequest';
import type { HttpResponse } from './HttpResponse';

export interface HttpHandlerInput {
  request: HttpRequest;
  response: HttpResponse;
}

/**
 * An HTTP request handler.
 */
export abstract class HttpHandler extends AsyncHandler<HttpHandlerInput> {}
