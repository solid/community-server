import { AsyncHandler } from '../../util/handlers/AsyncHandler';
import type { Operation } from '../operations/Operation';
import type { PermissionSet } from './PermissionSet';

/**
 * Verifies which permissions are requested on a given {@link Operation}.
 */
export abstract class PermissionsExtractor extends AsyncHandler<Operation, PermissionSet> {}
