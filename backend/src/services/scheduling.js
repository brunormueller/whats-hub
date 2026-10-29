/**
 * Agendamento pela IA: liga a conversa ao Google Calendar da conta.
 *
 * Duas pontas, chamadas pelo autoReply:
 *   - `calendarContext`  antes de gerar a resposta: janelas livres de verdade
 *                         para o modelo oferecer;
 *   - `applyBooking`      depois: se o cliente confirmou um horário, cria o
 *                         evento (revalidando a disponibilidade).
 *
 * Falha no Google nunca derruba o atendimento: sem contexto de agenda a IA
 * simplesmente atende sem oferecer horário, e erro ao criar vira handoff.
 */
import {
  bookSlot,
  calendarSettings,
  describeWindows,
  freeWindows,
  getConnection,
  googleConfigured,
} from './googleCalendar.js';

const TIMEZONE = process.env.AI_TIMEZONE || 'America/Sao_Paulo';

const when = (iso) => new Intl.DateTimeFormat('pt-BR', {
  timeZone: TIMEZONE,
  weekday: 'long',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
}).format(new Date(iso));

/** Contexto de agenda para o modelo, ou null quando a conta não agenda. */
export async function calendarContext(accountId, config, meta) {
  if (!config.calendar?.enabled || !googleConfigured()) return null;

  try {
    if (!(await getConnection(accountId))) return null;

    const free = await freeWindows(accountId, config);
    return {
      durationMin: free.cfg.durationMin,
      windows: describeWindows(free),
      booked: meta?.booking?.start ? when(meta.booking.start) : '',
    };
  } catch (err) {
    console.error(`⚠️  Agenda indisponível (${accountId}):`, err.message);
    return null;
  }
}

function eventTitle(config, lead, phoneNumber) {
  const name = lead?.fields?.nome || lead?.fields?.name || phoneNumber;
  return calendarSettings(config).eventTitle.replace(/\{nome\}/g, name);
}

function eventDescription(config, lead, phoneNumber) {
  const fields = lead
    ? Object.entries(lead.fields)
      .filter(([, v]) => v)
      .map(([k, v]) => `${lead.labels?.[k] || k}: ${v}`)
    : [];

  return [
    ...fields,
    `WhatsApp: https://wa.me/${phoneNumber}`,
    `Agendado por ${config.agentName || 'IA'} pelo WhatsApp.`,
  ].join('\n');
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Cria o evento do horário que o cliente confirmou.
 *
 * @returns {Promise<null|{booking: object}|{failed: 'unavailable'|'error'}>}
 *   null quando não há o que agendar.
 */
export async function applyBooking({ account, config, phoneNumber, result, meta }) {
  const wanted = result.booking;
  if (!wanted || meta?.booking?.start) return null;

  const email = result.lead?.fields?.email;

  try {
    // A janela é reconferida no Google dentro de bookSlot: o modelo pode ter
    // confirmado um horário que já foi ocupado nesse meio tempo.
    const slot = await bookSlot(account.id, config, {
      ...wanted,
      title: eventTitle(config, result.lead, phoneNumber),
      description: eventDescription(config, result.lead, phoneNumber),
      attendeeEmail: EMAIL_RE.test(email || '') ? email : '',
    });

    if (!slot.ok) return { failed: 'unavailable' };

    console.log(`📅 [${account.name}] ${phoneNumber} agendado para ${when(slot.start)}`);
    return {
      booking: { eventId: slot.eventId, link: slot.link, start: slot.start, end: slot.end },
    };
  } catch (err) {
    console.error(`⚠️  Falha ao criar evento (${account.id}):`, err.message);
    return { failed: 'error' };
  }
}
