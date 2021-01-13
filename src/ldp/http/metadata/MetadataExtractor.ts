import type { HttpRequest } from '../../../server/HttpRequest';
import { AsyncHandler } from '../../../util/handlers/AsyncHandler';
import type { RepresentationMetadata } from '../../representation/RepresentationMetadata';
import type { ResourceIdentifier } from '../../representation/ResourceIdentifier';

/**
 * Parses the metadata of a {@link HttpRequest} into a {@link RepresentationMetadata}.
 */
export abstract class MetadataExtractor extends
  AsyncHandler<{ request: HttpRequest; target: ResourceIdentifier }, RepresentationMetadata> {}
