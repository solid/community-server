import { AsyncHandler } from '../../src/util/handlers/AsyncHandler';

export class StaticAsyncHandler<TOut> extends AsyncHandler<any, TOut> {
  private readonly canHandleStatic: boolean;
  private readonly handleStatic: TOut;

  public constructor(canHandleStatic: boolean, handleStatic: TOut) {
    super();
    this.canHandleStatic = canHandleStatic;
    this.handleStatic = handleStatic;
  }

  public async canHandle(): Promise<void> {
    if (this.canHandleStatic) {
      return;
    }
    throw new Error('Not supported');
  }

  public async handle(): Promise<TOut> {
    return this.handleStatic;
  }
}
