import { Injectable, Logger } from '@nestjs/common';
import { EmailTemplates, Environment, Project, User } from '@prisma/client';
import { CreateEmailOptions, Resend } from 'resend';
import * as ejs from 'ejs';
import { EmailTemplateService } from './email-template.service';
import { render } from '@react-email/render';
import { ReactElement } from 'react';
import { DatabaseService } from '@/auth/modules/shared/database/database.service';
import { getFirstName } from '@/utils/services/names-helpers';

export enum EmailInternalFromTypes {
  SUPPORT = 'support',
  FOUNDER = 'founder',
}

export const internalEmails = {
  [EmailInternalFromTypes.SUPPORT]: {
    from: 'ThonLabs Support Team <support@thonlabs.io>',
    url: process.env.API_ROOT_URL,
  },
  [EmailInternalFromTypes.FOUNDER]: {
    from: 'Gus from ThonLabs <gus@thonlabs.io>',
    url: process.env.API_ROOT_URL,
  },
};

interface InternalSendEmailParams {
  from: EmailInternalFromTypes;
  to: CreateEmailOptions['to'];
  subject: CreateEmailOptions['subject'];
  content: ReactElement;
  scheduledAt?: Date;
}

interface SendEmailParams {
  to: CreateEmailOptions['to'];
  emailTemplateType: EmailTemplates;
  environmentId: string;
  userId?: string;
  projectId?: string;
  data?: {
    token?: string;
    environment?: Partial<
      Environment & {
        authURL: string;
        appURLEncoded: string;
        project: Partial<Project>;
      }
    >;
    user?: Partial<User> & { firstName?: string };
    inviter?: Partial<User>;
    publicKey?: string;
  };
  scheduledAt?: Date;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  private resend: Resend;

  constructor(
    private databaseService: DatabaseService,
    private emailTemplatesService: EmailTemplateService,
  ) {
    this.resend = new Resend(process.env.EMAIL_PROVIDER_API_KEY);
  }

  async send({
    to,
    environmentId,
    userId,
    emailTemplateType,
    data,
    scheduledAt,
  }: SendEmailParams) {
    const emailTemplate = await this.emailTemplatesService.getByType(
      emailTemplateType,
      environmentId,
    );

    const emailData = data || {};

    if (environmentId) {
      const environment = await this.getEnvironmentData(environmentId);
      emailData.environment = environment;
    }

    if (userId) {
      const user = await this.getUserData(userId);
      emailData.user = {
        ...user,
        firstName: getFirstName(user.fullName),
      };
    }

    let fromName;
    let subject;
    let html;

    try {
      fromName = ejs.render(emailTemplate.fromName, emailData);
      subject = ejs.render(emailTemplate.subject, emailData);
      html = ejs.render(emailTemplate.content, {
        ...emailData,
        preview: ejs.render(emailTemplate.preview, emailData),
      });
    } catch (e) {
      this.logger.error(
        `Error on rendering email ${emailTemplateType} - Env: ${environmentId}`,
        e,
      );
    }

    try {
      await this.resend.emails.send({
        from: `${fromName} <${emailTemplate.fromEmail}>`,
        to,
        subject,
        html,
        replyTo: emailTemplate.replyTo,
        scheduledAt: scheduledAt?.toISOString(),
      });

      this.logger.log(
        `Email ${emailTemplateType} ${scheduledAt ? 'scheduled' : 'sent'}`,
      );
    } catch (e) {
      this.logger.error(
        `Error on sending email ${emailTemplateType} - Env: ${environmentId}`,
        e,
      );
    }
  }

  async sendInternal({
    from,
    to,
    subject,
    content,
    scheduledAt,
  }: InternalSendEmailParams) {
    try {
      const internalEmail = internalEmails[from];

      if (!internalEmail) {
        this.logger.error(`Invalid internal email type "${from}"`);
        return;
      }

      await this.resend.emails.send({
        from: internalEmail.from,
        to,
        subject,
        html: render(content),
        scheduledAt: scheduledAt?.toISOString(),
      });

      this.logger.log(`Email "${subject}" sent (internal)`);
    } catch (e) {
      this.logger.error(`Error on sending email ${subject}`, e);
    }
  }

  private async getEnvironmentData(environmentId: string) {
    const environment = await this.databaseService.environment.findUnique({
      where: { id: environmentId },
      select: {
        id: true,
        name: true,
        appURL: true,
        project: {
          select: {
            id: true,
            appName: true,
          },
        },
      },
    });

    return environment;
  }

  private async getUserData(userId: string) {
    const user = await this.databaseService.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        lastSignIn: true,
        emailConfirmed: true,
        profilePicture: true,
      },
    });

    return user;
  }
}
