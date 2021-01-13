import { getLoggerFor } from '../../logging/LogUtil';
import type { AsyncHandler } from './AsyncHandler';
import { RecursiveAsyncHandler } from './RecursiveAsyncHandler';

/**
 * A composite handler that tries multiple handlers one by one
 * until it finds a handler that supports the input.
 * The handlers will be checked in the order they appear in the input array,
 * allowing for more fine-grained handlers to check before catch-all handlers.
 */
export class WaterfallHandler<TIn, TOut> extends RecursiveAsyncHandler<TIn, TOut> {
  protected readonly logger = getLoggerFor(this);

  /**
   * Creates a new WaterfallHandler that stores the given handlers.
   * @param handlers - Handlers over which it will run.
   */
  public constructor(handlers: AsyncHandler<TIn, TOut>[]) {
    super(handlers);
  }

  /**
   * Finds a handler that supports the given input and then lets it handle the given data.
   * @param input - The data that needs to be handled.
   *
   * @returns A promise corresponding to the handle call of a handler that supports the input.
   * It rejects if no handlers support the given data.
   */
  public async handle(input: TIn): Promise<TOut> {
    let handler: AsyncHandler<TIn, TOut>;

    try {
      handler = await this.canHandle(input);
    } catch {
      this.logger.warn('All handlers failed. This might be the consequence of calling handle before canHandle.');
      throw new Error('All handlers failed');
    }

    return handler.handle(input);
  }
}
