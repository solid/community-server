import { AsyncHandler } from '../../util/AsyncHandler';
import { HttpRequest } from '../../server/HttpRequest';
import { Operation } from '../operations/Operation';

/**
 * Converts an incoming HttpRequest to an Operation.
 */
export abstract class RequestParser extends AsyncHandler<HttpRequest, Operation> {}
