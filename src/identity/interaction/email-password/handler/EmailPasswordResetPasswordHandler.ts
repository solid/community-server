import assert from 'assert';
import { getLoggerFor } from '../../../../logging/LogUtil';
import type { HttpHandlerInput } from '../../../../server/HttpHandler';
import { HttpHandler } from '../../../../server/HttpHandler';
import type { RenderHandler } from '../../../../server/util/RenderHandler';
import { getFormDataRequestBody } from '../../util/getFormDataRequestBody';
import type { EmailPasswordStorageAdapter } from '../storage/EmailPasswordStorageAdapter';
import type { EmailPasswordResetPasswordRenderHandler } from './EmailPasswordResetPasswordRenderHandler';

export interface EmailPasswordResetPasswordHandlerArgs {
  emailPasswordStorageAdapter: EmailPasswordStorageAdapter;
  renderHandler: RenderHandler<{ errorMessage: string }>;
  messageRenderHandler: RenderHandler<{ message: string }>;
}

export class EmailPasswordResetPasswordHandler extends HttpHandler {
  private readonly emailPasswordStorageAdapter: EmailPasswordStorageAdapter;
  private readonly renderHandler: EmailPasswordResetPasswordRenderHandler;
  private readonly messageRenderHandler: RenderHandler<{ message: string }>;
  private readonly logger = getLoggerFor(this);

  public constructor(args: EmailPasswordResetPasswordHandlerArgs) {
    super();
    this.emailPasswordStorageAdapter = args.emailPasswordStorageAdapter;
    this.renderHandler = args.renderHandler;
    this.messageRenderHandler = args.messageRenderHandler;
  }

  public async handle(input: HttpHandlerInput): Promise<void> {
    let prefilledRecordId = '';
    try {
      // Parse params
      const {
        password,
        confirmPassword,
        recordId,
      } = await getFormDataRequestBody(input.request);
      assert(
        recordId && typeof recordId === 'string',
        'Invalid request. Open the link from your email again',
      );
      prefilledRecordId = recordId;
      assert(
        password &&
          typeof password === 'string' &&
          confirmPassword &&
          typeof confirmPassword === 'string',
        'Password and password confirmation must be provided',
      );
      assert(password === confirmPassword, 'Passwords do not match');

      // Reset password
      const email = await this.emailPasswordStorageAdapter.getForgotPasswordConfirmationRecord(
        recordId,
      );
      assert(email, 'This reset password link is no longer valid.');
      await this.emailPasswordStorageAdapter.deleteForgotPasswordConfirmationRecord(
        recordId,
      );

      await this.emailPasswordStorageAdapter.changePassword(email, password);

      await this.messageRenderHandler.handle({
        response: input.response,
        props: {
          message: 'Your password was successfully reset.',
        },
      });
    } catch (err: unknown) {
      const errorMessage: string =
        err instanceof Error ? err.message : 'An unknown error occurred';
      await this.renderHandler.handle({
        response: input.response,
        props: {
          errorMessage,
          recordId: prefilledRecordId,
        },
      });
    }
  }
}