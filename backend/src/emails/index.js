/**
 * E-mails transacionais do produto: HTML de arquivo + versão em texto puro.
 *
 * O template é lido uma vez, no import. Placeholder é `{{chave}}` e todo valor
 * passa por escape — nome e e-mail vêm do cadastro, então sem escape um nome
 * com `<` injetaria HTML no e-mail. Placeholder sem valor é erro na hora: um
 * `{{resetUrl}}` literal no e-mail do cliente é pior que uma falha no log.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const LOGO = {
  filename: 'logo.png',
  // string, não URL: o nodemailer trata objeto no `path` como conteúdo e quebra
  path: fileURLToPath(new URL('./logo.png', import.meta.url)),
  cid: 'logo@sheep',
};

const templates = {
  passwordReset: readFileSync(new URL('./recuperar-conta.html', import.meta.url), 'utf8'),
};

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escape = (value) => String(value).replace(/[&<>"']/g, (ch) => ESCAPES[ch]);

function render(template, values) {
  return template.replace(/{{(\w+)}}/g, (_, key) => {
    if (values[key] === undefined) throw new Error(`Template de e-mail sem valor para {{${key}}}`);
    return escape(values[key]);
  });
}

/** "Bruno Mueller" → "Bruno". O e-mail cumprimenta pelo primeiro nome. */
const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || 'tudo bem';

/**
 * @param {{ name: string, email: string, resetUrl: string, minutes: number, appUrl: string }} data
 * @returns campos prontos para `sendMail`
 */
export function passwordResetEmail({ name, email, resetUrl, minutes, appUrl }) {
  const greeting = firstName(name);

  return {
    subject: 'Recupere o acesso à sua conta Sheep',
    html: render(templates.passwordReset, {
      name: greeting,
      email,
      resetUrl,
      minutes,
      appUrl,
      year: new Date().getFullYear(),
    }),
    text: [
      `Oi, ${greeting}!`,
      '',
      `Recebemos um pedido para redefinir a senha da conta Sheep vinculada a ${email}.`,
      'Para criar uma nova senha, abra o link abaixo:',
      '',
      resetUrl,
      '',
      `O link vale por ${minutes} minutos e só pode ser usado uma vez.`,
      '',
      'Não foi você? Pode ignorar este e-mail: sua senha atual continua valendo.',
      'A equipe Sheep nunca pede sua senha por e-mail ou WhatsApp.',
      '',
      '— Sheep · Sua recepcionista de WhatsApp que nunca dorme',
    ].join('\n'),
    attachments: [LOGO],
  };
}
