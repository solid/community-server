import type { HttpRequest } from '../server/HttpRequest';
import { AsyncHandler } from '../util/handlers/AsyncHandler';
import type { Credentials } from './Credentials';

/**
 * Responsible for extracting credentials from an incoming request.
 */
export abstract class CredentialsExtractor extends AsyncHandler<HttpRequest, Credentials> {}
