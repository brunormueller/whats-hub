import { useMemo, useState } from 'react';
import ConversationList from '../components/ConversationList.jsx';
import ChatWindow from '../components/ChatWindow.jsx';
import ContactPanel from '../components/ContactPanel.jsx';
import { formatPhone, initials } from '../ui.jsx';

/** Deriva o chip de estado da conversa a partir do que o backend fornece. */
function tagOf(conversation, meta, aiEnabled) {
  if (meta.resolved) return 'Resolvida';
  // Só pausa explícita (operador assumiu) tira a IA da conversa.
  if (conversation.aiPaused || !aiEnabled) return 'Aguardando você';
  // needsHuman: a IA escalou, o time foi avisado — mas ela continua atendendo.
  if (conversation.needsHuman) return 'Escalada';
  return 'IA atendendo';
}

const AI_TAGS = ['IA atendendo', 'Escalada'];

export default function Inbox({
  conversations, selected, onSelect, messages, onSend,
  aiEnabled, onToggleAi, onPauseConv, onResumeConv,
  convMeta, onPatchMeta, ai, onGoSettings, channelPhone,
}) {
  const [filter, setFilter] = useState('minhas');
  const [query, setQuery] = useState('');

  const enriched = useMemo(() => conversations.map(c => {
    const meta = convMeta[c.phoneNumber] || {};
    return {
      ...c,
      name: formatPhone(c.phoneNumber),
      phone: `+${String(c.phoneNumber).replace(/\D/g, '')}`,
      initials: initials(c.phoneNumber),
      queue: meta.queue || 'Suporte',
      labels: meta.labels || [],
      tag: tagOf(c, meta, aiEnabled),
    };
  }), [conversations, convMeta, aiEnabled]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return enriched.filter(c => {
      if (filter === 'minhas' && c.tag === 'Resolvida') return false;
      if (filter === 'ia' && !AI_TAGS.includes(c.tag)) return false;
      if (!q) return true;
      return c.name.toLowerCase().includes(q)
        || c.phoneNumber.includes(q.replace(/\D/g, '') || q);
    });
  }, [enriched, filter, query]);

  const active = enriched.find(c => c.phoneNumber === selected) || null;

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
      <ConversationList
        conversations={visible}
        selected={selected}
        onSelect={onSelect}
        filter={filter}
        onFilter={setFilter}
        query={query}
        onQuery={setQuery}
      />

      <ChatWindow
        conversation={active}
        messages={messages}
        onSend={onSend}
        aiEnabled={aiEnabled}
        onPauseConv={() => active && onPauseConv(active.phoneNumber)}
        onResumeConv={() => active && onResumeConv(active.phoneNumber)}
        onResolve={() => active && onPatchMeta(active.phoneNumber, { resolved: true })}
        onTransfer={queue => active && onPatchMeta(active.phoneNumber, { queue })}
      />

      <ContactPanel
        conversation={active}
        aiEnabled={aiEnabled}
        onToggleAi={onToggleAi}
        ai={ai}
        onGoSettings={onGoSettings}
        labels={active?.labels || []}
        onAddLabel={l => active && onPatchMeta(active.phoneNumber, {
          labels: [...(active.labels || []), l],
        })}
        channelPhone={channelPhone}
      />
    </div>
  );
}
