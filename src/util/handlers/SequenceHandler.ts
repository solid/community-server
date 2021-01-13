import { AsyncHandler } from './AsyncHandler';

/**
 * A composite handler that will try to run all supporting handlers sequentially
 * and return the value of the last supported handler.
 * The `canHandle` check of this handler will always succeed.
 */
export class SequenceHandler<TIn = void, TOut = void> extends AsyncHandler<TIn, TOut | undefined> {
  private readonly handlers: AsyncHandler<TIn, TOut>[];

  public constructor(handlers: AsyncHandler<TIn, TOut>[]) {
    super();
    this.handlers = [ ...handlers ];
  }

  public async handle(input: TIn): Promise<TOut | undefined> {
    let result: TOut | undefined;
    for (const handler of this.handlers) {
      let supported: boolean;
      try {
        await handler.canHandle(input);
        supported = true;
      } catch {
        supported = false;
      }
      if (supported) {
        result = await handler.handle(input);
      }
    }
    return result;
  }
}
