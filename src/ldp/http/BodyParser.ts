import type { HttpRequest } from '../../server/HttpRequest';
import { AsyncHandler } from '../../util/handlers/AsyncHandler';
import type { Representation } from '../representation/Representation';
import type { RepresentationMetadata } from '../representation/RepresentationMetadata';

export interface BodyParserArgs {
  /**
   * Request that contains the (potential) body.
   */
  request: HttpRequest;
  /**
   * Metadata that has already been parsed from the request.
   * Can be updated by the BodyParser with extra metadata.
   */
  metadata: RepresentationMetadata;
}

/**
 * Parses the body of an incoming {@link HttpRequest} and converts it to a {@link Representation}.
 */
export abstract class BodyParser extends
  AsyncHandler<BodyParserArgs, Representation | undefined> {}
