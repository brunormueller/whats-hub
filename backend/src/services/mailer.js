/**
 * Envio de e-mail por SMTP (nodemailer).
 *
 * SMTP e não a API de um provedor: Resend, Brevo, SES, Mailgun e o próprio
 * Gmail falam SMTP, então trocar de provedor é trocar o `.env`.
 *
 * Sem SMTP_HOST o servidor sobe normalmente. Fora de produção o e-mail vai
 * para o console (dá para copiar o link de recuperação de lá); em produção só
 * registra que não enviou — link de recuperação em log é credencial vazada.
 */
import nodemailer from 'nodemailer';

let transport = null;

export function mailConfigured() {
  return Boolean(process.env.SMTP_HOST);
}

function transporter() {
  if (transport) return transport;

  const port = Number(process.env.SMTP_PORT) || 587;

  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    // 465 é TLS direto; 587 começa em claro e sobe para TLS com STARTTLS
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });

  return transport;
}

/**
 * @param {{ to: string, subject: string, html: string, text: string, attachments?: object[] }} mail
 */
export async function sendMail({ to, subject, html, text, attachments }) {
  if (!mailConfigured()) {
    if (process.env.NODE_ENV === 'production') {
      console.error(`✉️  SMTP não configurado — e-mail "${subject}" para ${to} NÃO foi enviado`);
    } else {
      console.log(`✉️  [sem SMTP] Para: ${to} · ${subject}\n${text}\n`);
    }
    return;
  }

  await transporter().sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    replyTo: process.env.MAIL_REPLY_TO || undefined,
    to,
    subject,
    html,
    text,
    attachments,
  });
}
