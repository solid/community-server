import type { Credentials } from '../authentication/Credentials';
import type { CredentialsExtractor } from '../authentication/CredentialsExtractor';
import type { Authorizer } from '../authorization/Authorizer';
import { getLoggerFor } from '../logging/LogUtil';
import type { HttpHandlerInput } from '../server/HttpHandler';
import { HttpHandler } from '../server/HttpHandler';
import type { HttpRequest } from '../server/HttpRequest';
import type { HttpResponse } from '../server/HttpResponse';
import type { RequestParser } from './http/RequestParser';
import type { ResponseDescription } from './http/response/ResponseDescription';
import type { ResponseWriter } from './http/ResponseWriter';
import type { Operation } from './operations/Operation';
import type { OperationHandler } from './operations/OperationHandler';
import type { PermissionSet } from './permissions/PermissionSet';
import type { PermissionsExtractor } from './permissions/PermissionsExtractor';

/**
 * Collection of handlers needed for {@link AuthenticatedLdpHandler} to function.
 */
export interface AuthenticatedLdpHandlerArgs {
  /**
   * Parses the incoming requests.
   */
  requestParser: RequestParser;
  /**
   * Extracts the credentials from the incoming request.
   */
  credentialsExtractor: CredentialsExtractor;
  /**
   * Extracts the required permissions from the generated Operation.
   */
  permissionsExtractor: PermissionsExtractor;
  /**
   * Verifies if the requested operation is allowed.
   */
  authorizer: Authorizer;
  /**
   * Executed the operation.
   */
  operationHandler: OperationHandler;
  /**
   * Writes out the response of the operation.
   */
  responseWriter: ResponseWriter;
}

/**
 * The central manager that connects all the necessary handlers to go from an incoming request to an executed operation.
 */
export class AuthenticatedLdpHandler extends HttpHandler {
  private readonly requestParser!: RequestParser;
  private readonly credentialsExtractor!: CredentialsExtractor;
  private readonly permissionsExtractor!: PermissionsExtractor;
  private readonly authorizer!: Authorizer;
  private readonly operationHandler!: OperationHandler;
  private readonly responseWriter!: ResponseWriter;
  private readonly logger = getLoggerFor(this);

  /**
   * Creates the handler.
   * @param args - The handlers required. None of them are optional.
   */
  public constructor(args: AuthenticatedLdpHandlerArgs) {
    super();
    Object.assign(this, args);
  }

  /**
   * Checks if the incoming request can be handled. The check is very non-restrictive and will usually be true.
   * It is based on whether the incoming request can be parsed to an operation.
   * @param input - Incoming request and response. Only the request will be used.
   *
   * @returns A promise resolving if this request can be handled, otherwise rejecting with an Error.
   */
  public async canHandle(input: HttpHandlerInput): Promise<void> {
    return this.requestParser.canHandle(input.request) as Promise<void>;
  }

  /**
   * Handles the incoming request and writes out the response.
   * This includes the following steps:
   *  - Parsing the request to an Operation.
   *  - Extracting credentials from the request.
   *  - Extracting the required permissions.
   *  - Validating if this operation is allowed.
   *  - Executing the operation.
   *  - Writing out the response.
   * @param input - The incoming request and response object to write to.
   *
   * @returns A promise resolving when the handling is finished.
   */
  public async handle(input: HttpHandlerInput): Promise<void> {
    let writeData: { response: HttpResponse; result: ResponseDescription | Error };

    try {
      writeData = { response: input.response, result: await this.runHandlers(input.request) };
    } catch (error: unknown) {
      if (error instanceof Error) {
        writeData = { response: input.response, result: error };
      } else {
        throw error;
      }
    }

    await this.responseWriter.handleSafe(writeData);
  }

  /**
   * Runs all handlers except writing the output to the response.
   * This because any errors thrown here have an impact on the response.
   * @param request - Incoming request.
   *
   * @returns A promise resolving to the generated Operation.
   */
  private async runHandlers(request: HttpRequest): Promise<ResponseDescription> {
    this.logger.verbose(`Handling LDP request for ${request.url}`);

    const operation: Operation = await this.requestParser.handleSafe(request);
    this.logger.verbose(`Parsed ${operation.method} operation on ${operation.target.path}`);

    const credentials: Credentials = await this.credentialsExtractor.handleSafe(request);
    this.logger.verbose(`Extracted credentials: ${credentials.webId}`);

    const permissions: PermissionSet = await this.permissionsExtractor.handleSafe(operation);
    const { read, write, append } = permissions;
    this.logger.verbose(`Required permissions are read: ${read}, write: ${write}, append: ${append}`);

    try {
      await this.authorizer.handleSafe({ credentials, identifier: operation.target, permissions });
    } catch (error: unknown) {
      this.logger.verbose(`Authorization failed: ${(error as any).message}`);
      throw error;
    }

    this.logger.verbose(`Authorization succeeded, performing operation`);
    return this.operationHandler.handleSafe(operation);
  }
}
