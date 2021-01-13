import type { HttpRequest } from '../../server/HttpRequest';
import { AsyncHandler } from '../../util/handlers/AsyncHandler';
import type { Operation } from '../operations/Operation';

/**
 * Converts an incoming HttpRequest to an Operation.
 */
export abstract class RequestParser extends AsyncHandler<HttpRequest, Operation> {}
