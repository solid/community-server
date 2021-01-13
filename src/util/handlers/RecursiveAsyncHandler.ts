import { BadRequestHttpError } from '../errors/BadRequestHttpError';
import { HttpError } from '../errors/HttpError';
import { InternalServerError } from '../errors/InternalServerError';
import { NotImplementedHttpError } from '../errors/NotImplementedHttpError';
import { AsyncHandler } from './AsyncHandler';

/**
 * Simple base class for choosing a handler amongst the ones passed through dependency injection (DI).
 * Note that RecursiveAsyncHandlers can be passed through DI to RecursiveAsyncHandler.
 */
export abstract class RecursiveAsyncHandler<TIn = void, TOut = void> extends AsyncHandler<TIn, TOut> {
  private readonly handlers: AsyncHandler<TIn, TOut>[];

  /**
   * Creates a new RecursiveAsyncHandler that stores the given handlers.
   * @param handlers - Handlers over which it will run.
   */
  public constructor(handlers: AsyncHandler<TIn, TOut>[]) {
    super();
    this.handlers = handlers;
  }

  /**
   * Checks if the input data can be handled by one of the handlers.
   * Throws an error if it can't handle the data.
   * @param input - Input data that could potentially be handled.
   *
   * @returns A promise resolving to a handler that is not recursive and supports the data or otherwise rejecting.
   */
  public async canHandle(input: TIn): Promise<AsyncHandler<TIn, TOut>> {
    const errors: HttpError[] = [];

    for (const handler of this.handlers) {
      try {
        if (handler instanceof RecursiveAsyncHandler) {
          return handler.handleSafe(input);
        }
        await handler.canHandle(input);

        return handler;
      } catch (error: unknown) {
        if (error instanceof HttpError) {
          errors.push(error);
        } else if (error instanceof Error) {
          errors.push(new InternalServerError(error.message));
        } else {
          errors.push(new InternalServerError('Unknown error'));
        }
      }
    }

    const joined = errors.map((error: Error): string => error.message).join(', ');
    const message = `No handler supports the given input: [${joined}]`;

    // Check if all errors have the same status code
    if (errors.every((error): boolean => error.statusCode === errors[0].statusCode)) {
      throw new HttpError(errors[0].statusCode, errors[0].name, message);
    }

    // Find the error range (4xx or 5xx)
    if (errors.some((error): boolean => error.statusCode >= 500)) {
      throw new InternalServerError(message);
    }
    throw new BadRequestHttpError(message);
  }

  /**
   * Recursive handlers are not meant to handle the data themselves.
   * @param input - The data that needs to be handled.
   *
   * @returns An error.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async handle(input: TIn): Promise<TOut> {
    throw new NotImplementedHttpError('A recursive handler should not handle data itself.');
  }

  /**
   * Helper function that first gets the first non-recursive handler that canHandle the data then runs it.
   * Throws the error of the {@link canHandle} function if the data can't be handled,
   * or returns the result of the {@link handle} function otherwise.
   * @param input - The input data.
   *
   * @returns A promise corresponding to the handle call of a handler that supports the input.
   * It rejects if no handlers support the given data.
   */
  public async handleSafe(input: TIn): Promise<TOut> {
    const handler = await this.canHandle(input);

    return handler.handle(input);
  }
}
