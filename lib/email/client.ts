import { createTransport, type Transporter } from "nodemailer";
import { render } from "@react-email/render";
import type { ReactElement } from "react";

/**
 * Transactional email via Brevo's SMTP relay. Lazily constructed so builds/
 * dev don't fail before BREVO_SMTP_USER/BREVO_SMTP_KEY are configured.
 * Setup: https://app.brevo.com/settings/keys/smtp — the "Login" shown there
 * is BREVO_SMTP_USER, generate an SMTP key for BREVO_SMTP_KEY.
 *
 * Exposes the same `emails.send({ from, to, subject, html | react })` shape
 * Resend used, so call sites didn't need to change — only `react` payloads
 * need rendering to HTML first, since nodemailer has no built-in JSX support.
 */
let transport: Transporter | null = null;

function getTransport(): Transporter {
  if (!process.env.BREVO_SMTP_USER || !process.env.BREVO_SMTP_KEY) {
    throw new Error("BREVO_SMTP_USER/BREVO_SMTP_KEY is not set");
  }
  if (!transport) {
    transport = createTransport({
      host: "smtp-relay.brevo.com",
      port: 587,
      auth: {
        user: process.env.BREVO_SMTP_USER,
        pass: process.env.BREVO_SMTP_KEY,
      },
    });
  }
  return transport;
}

interface SendEmailParams {
  from: string;
  to: string | string[];
  subject: string;
  html?: string;
  react?: ReactElement;
}

export function getEmailClient() {
  return {
    emails: {
      async send(params: SendEmailParams) {
        const html = params.react ? await render(params.react) : params.html;
        return getTransport().sendMail({
          from: params.from,
          to: params.to,
          subject: params.subject,
          html,
        });
      },
    },
  };
}
