import { AsyncHandler } from '../../../src/util/handlers/AsyncHandler';
import { StaticAsyncHandler } from '../../util/StaticAsyncHandler';

describe('An AsyncHandler', (): void => {
  it('supports any input by default.', async(): Promise<void> => {
    class EmptyHandler<T> extends AsyncHandler<T, null> {
      public async handle(): Promise<null> {
        return null;
      }
    }
    const handler = new EmptyHandler<string>();
    await expect(handler.canHandle('test')).resolves.toBeUndefined();
  });

  it('calls canHandle and handle when handleSafe is called.', async(): Promise<void> => {
    const handlerTrue: AsyncHandler<any, any> = new StaticAsyncHandler(true, null);
    const canHandleFn = jest.fn(async(input: any): Promise<void> => input);
    const handleFn = jest.fn(async(input: any): Promise<any> => input);

    handlerTrue.canHandle = canHandleFn;
    handlerTrue.handle = handleFn;
    await expect(handlerTrue.handleSafe('test')).resolves.toBe('test');
    expect(canHandleFn).toHaveBeenCalledTimes(1);
    expect(handleFn).toHaveBeenCalledTimes(1);
  });

  it('does not call handle when canHandle errors during a handleSafe call.', async(): Promise<void> => {
    const handlerFalse: AsyncHandler<any, any> = new StaticAsyncHandler(false, null);
    const canHandleFn = jest.fn(async(): Promise<void> => {
      throw new Error('test');
    });
    const handleFn = jest.fn(async(input: any): Promise<any> => input);

    handlerFalse.canHandle = canHandleFn;
    handlerFalse.handle = handleFn;
    await expect(handlerFalse.handleSafe('test')).rejects.toThrow(Error);
    expect(canHandleFn).toHaveBeenCalledTimes(1);
    expect(handleFn).toHaveBeenCalledTimes(0);
  });
});
