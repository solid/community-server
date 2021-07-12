import { BadRequestHttpError } from '../../../../src/util/errors/BadRequestHttpError';
import { ConflictHttpError } from '../../../../src/util/errors/ConflictHttpError';
import { ForbiddenHttpError } from '../../../../src/util/errors/ForbiddenHttpError';
import type { HttpErrorOptions } from '../../../../src/util/errors/HttpError';
import { HttpError } from '../../../../src/util/errors/HttpError';
import { InternalServerError } from '../../../../src/util/errors/InternalServerError';
import { MethodNotAllowedHttpError } from '../../../../src/util/errors/MethodNotAllowedHttpError';
import { NotFoundHttpError } from '../../../../src/util/errors/NotFoundHttpError';
import { NotImplementedHttpError } from '../../../../src/util/errors/NotImplementedHttpError';
import { UnauthorizedHttpError } from '../../../../src/util/errors/UnauthorizedHttpError';
import { UnsupportedMediaTypeHttpError } from '../../../../src/util/errors/UnsupportedMediaTypeHttpError';

// Only used to make typings easier in the tests
class FixedHttpError extends HttpError {
  public constructor(message?: string, options?: HttpErrorOptions) {
    super(0, '', message, options);
  }
}

describe('HttpError', (): void => {
  const errors: [string, number, typeof FixedHttpError][] = [
    [ 'BadRequestHttpError', 400, BadRequestHttpError ],
    [ 'UnauthorizedHttpError', 401, UnauthorizedHttpError ],
    [ 'ForbiddenHttpError', 403, ForbiddenHttpError ],
    [ 'NotFoundHttpError', 404, NotFoundHttpError ],
    [ 'MethodNotAllowedHttpError', 405, MethodNotAllowedHttpError ],
    [ 'ConflictHttpError', 409, ConflictHttpError ],
    [ 'MethodNotAllowedHttpError', 405, MethodNotAllowedHttpError ],
    [ 'UnsupportedMediaTypeHttpError', 415, UnsupportedMediaTypeHttpError ],
    [ 'InternalServerError', 500, InternalServerError ],
    [ 'NotImplementedHttpError', 501, NotImplementedHttpError ],
  ];

  describe.each(errors)('%s', (name, statusCode, constructor): void => {
    const options = {
      cause: new Error('cause'),
      errorCode: 'E1234',
      details: {},
    };
    const instance = new constructor('my message', options);

    it(`is an instance of ${name}.`, (): void => {
      expect(constructor.isInstance(instance)).toBeTruthy();
    });

    it(`has name ${name}.`, (): void => {
      expect(instance.name).toBe(name);
    });

    it(`has status code ${statusCode}.`, (): void => {
      expect(instance.statusCode).toBe(statusCode);
    });

    it('sets the message.', (): void => {
      expect(instance.message).toBe('my message');
    });

    it('sets the cause.', (): void => {
      expect(instance.cause).toBe(options.cause);
    });

    it('sets the error code.', (): void => {
      expect(instance.errorCode).toBe(options.errorCode);
    });

    it('sets the details.', (): void => {
      expect(instance.details).toBe(options.details);
    });
  });
});
