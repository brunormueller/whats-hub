import { useState } from 'react';

/* Primitivos visuais do design "Atende IA".
   As cores vêm das CSS vars declaradas em index.html (tema claro/escuro). */

export const MONO = "'Geist Mono', ui-monospace, monospace";

/** Chip de status. kind: 'ok' | 'warn' | 'mut' | 'bad' */
export function pill(kind = 'mut') {
  const map = {
    ok: { background: 'var(--accsoft)', color: 'var(--accfg)', borderColor: 'transparent' },
    warn: { background: 'transparent', color: 'var(--warn)', borderColor: 'currentColor' },
    mut: { background: 'var(--muted)', color: 'var(--mfg)', borderColor: 'transparent' },
    bad: { background: 'var(--dangersoft)', color: 'var(--danger)', borderColor: 'transparent' },
  };
  return {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    fontSize: 11, fontWeight: 500,
    border: '1px solid', borderRadius: 6, padding: '2px 8px',
    ...(map[kind] || map.mut),
  };
}

/** Estilos do switch (trilho + botão) */
export function switchStyles(on) {
  return {
    track: {
      width: 36, height: 20, flex: 'none', borderRadius: 999, border: 0,
      cursor: 'pointer', padding: 2, display: 'flex',
      justifyContent: on ? 'flex-end' : 'flex-start',
      background: on ? 'var(--pri)' : 'var(--bd)',
      transition: 'background .15s',
    },
    knob: {
      width: 16, height: 16, borderRadius: 999,
      background: on ? 'var(--prifg)' : 'var(--card)',
      display: 'block', boxShadow: '0 1px 2px rgba(0,0,0,.2)',
    },
  };
}

export function Switch({ on, onChange, title }) {
  const st = switchStyles(on);
  return (
    <button type="button" title={title} style={st.track} onClick={onChange} aria-pressed={on}>
      <span style={st.knob} />
    </button>
  );
}

/** Elemento com estilo de hover (o design usa style-hover) */
export function Hover({ as: Tag = 'button', style, hoverStyle, ...rest }) {
  const [over, setOver] = useState(false);
  return (
    <Tag
      style={over ? { ...style, ...hoverStyle } : style}
      onMouseEnter={() => setOver(true)}
      onMouseLeave={() => setOver(false)}
      {...rest}
    />
  );
}

export const HOVER_MUTED = { background: 'var(--muted)' };

/* ---- botões recorrentes ---- */

export const btnPrimary = (h = 34, pad = 15) => ({
  height: h, padding: `0 ${pad}px`, border: 0,
  background: 'var(--pri)', color: 'var(--prifg)',
  borderRadius: h >= 34 ? 8 : 7, fontSize: h >= 34 ? 13 : 12.5,
  fontWeight: 500, cursor: 'pointer',
});

export const btnGhost = (h = 34, pad = 13) => ({
  height: h, padding: `0 ${pad}px`, border: '1px solid var(--bd)',
  background: 'var(--card)', borderRadius: h >= 34 ? 8 : 7,
  fontSize: h >= 34 ? 13 : 12.5, fontWeight: 500, cursor: 'pointer',
});

export const card = {
  border: '1px solid var(--bd)', borderRadius: 12,
  background: 'var(--card)', boxShadow: 'var(--shadow)',
};

export const sectionLabel = {
  fontSize: 11, fontWeight: 600, letterSpacing: '.06em',
  textTransform: 'uppercase', color: 'var(--mfg)',
};

export const inputStyle = {
  height: 36, padding: '0 11px', border: '1px solid var(--bd)',
  borderRadius: 8, background: 'var(--bg)', outline: 'none', fontSize: 13,
  width: '100%',
};

export const textareaStyle = {
  padding: '10px 11px', border: '1px solid var(--bd)', borderRadius: 8,
  background: 'var(--bg)', outline: 'none', fontSize: 13,
  lineHeight: 1.55, resize: 'vertical', width: '100%',
};

/* ---- formatação ---- */

/** 5511988724410 -> +55 11 98872-4410 */
export function formatPhone(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  if (d.length === 13) return `+${d.slice(0, 2)} ${d.slice(2, 4)} ${d.slice(4, 9)}-${d.slice(9)}`;
  if (d.length === 12) return `+${d.slice(0, 2)} ${d.slice(2, 4)} ${d.slice(4, 8)}-${d.slice(8)}`;
  if (d.length === 11) return `${d.slice(0, 2)} ${d.slice(2, 7)}-${d.slice(7)}`;
  return raw || '';
}

/** Iniciais do avatar: os dois últimos dígitos do número */
export function initials(phoneNumber) {
  const d = String(phoneNumber || '').replace(/\D/g, '');
  return d.slice(-2) || '··';
}

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Rótulo curto para a lista: 09:41 · ontem · ter · 12/07 */
export function shortTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const days = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86400000);
  if (days <= 0) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (days === 1) return 'ontem';
  if (days < 7) return WEEKDAYS[d.getDay()];
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function clockTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/** Separador de dia dentro da thread */
export function dayLabel(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const days = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86400000);
  if (days <= 0) return 'Hoje';
  if (days === 1) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
}

export function dayKey(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : startOfDay(d);
}
