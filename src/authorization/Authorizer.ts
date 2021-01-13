import type { Credentials } from '../authentication/Credentials';
import type { PermissionSet } from '../ldp/permissions/PermissionSet';
import type { ResourceIdentifier } from '../ldp/representation/ResourceIdentifier';
import { AsyncHandler } from '../util/handlers/AsyncHandler';

/**
 * Verifies if the given credentials have access to the given permissions on the given resource.
 * An {@link Error} with the necessary explanation will be thrown when permissions are not granted.
 */
export abstract class Authorizer extends AsyncHandler<AuthorizerArgs> {}

export interface AuthorizerArgs {
  /**
   * Credentials of the entity that wants to use the resource.
   */
  credentials: Credentials;
  /**
   * Identifier of the resource that will be read/modified.
   */
  identifier: ResourceIdentifier;
  /**
   * Permissions that are requested on the resource.
   */
  permissions: PermissionSet;
}
