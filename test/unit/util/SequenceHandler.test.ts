import type { AsyncHandler } from '../../../src/util/handlers/AsyncHandler';
import { SequenceHandler } from '../../../src/util/handlers/SequenceHandler';

describe('A SequenceHandler', (): void => {
  const handlers: jest.Mocked<AsyncHandler<string, string>>[] = [
    {
      canHandle: jest.fn(),
      handle: jest.fn().mockResolvedValue('0'),
    } as any,
    {
      canHandle: jest.fn().mockRejectedValue(new Error('not supported')),
      handle: jest.fn().mockRejectedValue(new Error('should not be called')),
    } as any,
    {
      canHandle: jest.fn(),
      handle: jest.fn().mockResolvedValue('2'),
    } as any,
  ];
  let composite: SequenceHandler<string, string>;

  beforeEach(async(): Promise<void> => {
    composite = new SequenceHandler<string, string>(handlers);
  });

  it('can handle all input.', async(): Promise<void> => {
    await expect(composite.canHandle('test')).resolves.toBeUndefined();
  });

  it('runs all supported handlers.', async(): Promise<void> => {
    await composite.handleSafe('test');

    expect(handlers[0].canHandle).toHaveBeenCalledTimes(1);
    expect(handlers[0].canHandle).toHaveBeenLastCalledWith('test');
    expect(handlers[0].handle).toHaveBeenCalledTimes(1);
    expect(handlers[0].handle).toHaveBeenLastCalledWith('test');

    expect(handlers[1].canHandle).toHaveBeenCalledTimes(1);
    expect(handlers[1].canHandle).toHaveBeenLastCalledWith('test');
    expect(handlers[1].handle).toHaveBeenCalledTimes(0);

    expect(handlers[2].canHandle).toHaveBeenCalledTimes(1);
    expect(handlers[2].canHandle).toHaveBeenLastCalledWith('test');
    expect(handlers[2].handle).toHaveBeenCalledTimes(1);
    expect(handlers[2].handle).toHaveBeenLastCalledWith('test');
  });

  it('returns the result of the last supported handler.', async(): Promise<void> => {
    await expect(composite.handleSafe('test')).resolves.toBe('2');

    handlers[2].canHandle.mockRejectedValueOnce(new Error('not supported'));
    await expect(composite.handleSafe('test')).resolves.toBe('0');
  });

  it('returns undefined if no handler is supported.', async(): Promise<void> => {
    handlers[0].canHandle.mockRejectedValueOnce(new Error('not supported'));
    handlers[2].canHandle.mockRejectedValueOnce(new Error('not supported'));
    await expect(composite.handleSafe('test')).resolves.toBeUndefined();
  });

  it('errors if a handler errors.', async(): Promise<void> => {
    handlers[2].handle.mockRejectedValueOnce(new Error('failure'));
    await expect(composite.handleSafe('test')).rejects.toThrow('failure');
  });
});
