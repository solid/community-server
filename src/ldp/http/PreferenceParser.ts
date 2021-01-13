import type { HttpRequest } from '../../server/HttpRequest';
import { AsyncHandler } from '../../util/handlers/AsyncHandler';
import type { RepresentationPreferences } from '../representation/RepresentationPreferences';

/**
 * Creates {@link RepresentationPreferences} based on the incoming HTTP headers in a {@link HttpRequest}.
 */
export abstract class PreferenceParser extends AsyncHandler<{ request: HttpRequest }, RepresentationPreferences> {}
