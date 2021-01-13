import type { Representation } from '../../ldp/representation/Representation';
import type { ResourceIdentifier } from '../../ldp/representation/ResourceIdentifier';
import { AsyncHandler } from '../../util/handlers/AsyncHandler';
import type { ResourceStore } from '../ResourceStore';

/**
 * Finds which store needs to be accessed for the given resource,
 * potentially based on the Representation of incoming data.
 */
export abstract class RouterRule
  extends AsyncHandler<{ identifier: ResourceIdentifier; representation?: Representation }, ResourceStore> {}
