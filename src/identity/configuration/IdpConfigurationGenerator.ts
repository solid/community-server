import type { Configuration } from 'oidc-provider';

/**
 * Creates an IdP Configuration to be used in
 * panva/node-oidc-provider
 */
export abstract class IdpConfigurationGenerator {
  abstract createConfiguration(): Promise<Configuration>;
}