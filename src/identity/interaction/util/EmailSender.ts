import { createTransport } from 'nodemailer';
import type Mail from 'nodemailer/lib/mailer';

export interface EmailSenderArgs {
  emailConfig: {
    name: string;
    host: string;
    port: number;
    auth: {
      user: string;
      pass: string;
    };
  };
  senderName?: string;
}

export class EmailSender {
  private readonly mailTransporter: Mail;
  private readonly senderName: string;

  public constructor(args: EmailSenderArgs) {
    this.mailTransporter = createTransport(args.emailConfig);
    this.senderName = args.senderName ?? 'Solid';
  }

  public async sendEmail(emailAddress: string, content: {
    subject: string;
    text: string;
    html: string;
  }): Promise<void> {
    const thing = await this.mailTransporter.sendMail({
      from: this.senderName,
      to: emailAddress,
      subject: content.subject,
      text: content.text,
      html: content.html,
    });
    console.log(thing);
  }
}