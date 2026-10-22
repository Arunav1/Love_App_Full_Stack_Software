import { Fragment, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUp, RotateCcw, Sparkles, Square, Trash2 } from 'lucide-react';
import { useApp } from '../lib/store.jsx';
import { Confirm } from '../components/Modal.jsx';

const KEY = 'kaveri.chat'; // chats stay private, in her browser only

const load = () => {
  try { return JSON.parse(localStorage.getItem(KEY)) ?? []; } catch { return []; }
};
const persist = (msgs) => {
  try { localStorage.setItem(KEY, JSON.stringify(msgs.slice(-100))); } catch { /* private mode */ }
};

const SUGGESTIONS = [
  'Write me a little love poem 💌',
  'I’m feeling low today…',
  'Give me a cute date idea for us',
  'Why does he love me so much?',
  'Recommend a romantic song 🎶',
  'Help me plan a surprise for him',
];

// Tiny, safe markdown: **bold**, *italic*, `code`, lists and paragraphs – rendered as React, never as HTML.
function inline(text) {
  return text.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`)/g).map((part, i) => {
    if (/^\*\*.+\*\*$/.test(part)) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (/^\*.+\*$/.test(part)) return <em key={i}>{part.slice(1, -1)}</em>;
    if (/^`.+`$/.test(part)) return <code key={i}>{part.slice(1, -1)}</code>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

function Markdown({ text }) {
  const blocks = [];
  let list = null;
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    const item = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (item) {
      const ordered = /^\s*\d/.test(line);
      if (!list || list.ordered !== ordered) blocks.push((list = { ordered, items: [] }));
      list.items.push(item[1]);
      continue;
    }
    list = null;
    const heading = line.match(/^#{1,4}\s+(.*)$/);
    if (heading) blocks.push({ p: heading[1], bold: true });
    else if (line.trim()) blocks.push({ p: line });
    else blocks.push({ gap: true });
  }
  return blocks.map((b, i) => {
    if (b.items) {
      const Tag = b.ordered ? 'ol' : 'ul';
      return <Tag key={i}>{b.items.map((it, j) => <li key={j}>{inline(it)}</li>)}</Tag>;
    }
    if (b.gap) return <div key={i} className="gap" />;
    return <p key={i}>{b.bold ? <strong>{inline(b.p)}</strong> : inline(b.p)}</p>;
  });
}

export default function Chat() {
  const { settings, boot } = useApp();
  const enabled = boot.features?.chat;
  const [messages, setMessages] = useState(load);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const abort = useRef(null);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { if (!streaming) persist(messages); }, [messages, streaming]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages]);
  useEffect(() => () => abort.current?.abort(), []);

  // Grow the textarea with its content
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  const send = async (text, history = messages) => {
    text = text.trim();
    if (!text || streaming) return;
    const next = [...history, { role: 'user', content: text }];
    setMessages([...next, { role: 'assistant', content: '', pending: true }]);
    setInput('');
    setStreaming(true);
    const controller = new AbortController();
    abort.current = controller;
    let reply = '';
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next.filter((m) => !m.error).map(({ role, content }) => ({ role, content })) }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Cupid couldn’t answer right now.');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        reply += decoder.decode(value, { stream: true });
        setMessages([...next, { role: 'assistant', content: reply, pending: true }]);
      }
      setMessages([...next, { role: 'assistant', content: reply || '💗' }]);
    } catch (err) {
      if (controller.signal.aborted) {
        setMessages([...next, ...(reply ? [{ role: 'assistant', content: reply }] : [])]);
      } else {
        setMessages([...next, { role: 'assistant', content: err.message, error: true }]);
      }
    } finally {
      setStreaming(false);
      abort.current = null;
      inputRef.current?.focus();
    }
  };

  const retry = () => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUser) return;
    const cut = messages.lastIndexOf(lastUser);
    send(lastUser.content, messages.slice(0, cut));
  };

  const firstName = settings.nickname || settings.herName;

  return (
    <main className="page chat-page">
      <div className="chat-head">
        <div className="cupid-avatar big">💘</div>
        <div>
          <h1>Cupid</h1>
          <p>Your little AI companion, made by {settings.fromName} so you always have someone to talk to.</p>
        </div>
        {messages.length > 0 && (
          <button className="btn small" onClick={() => setConfirmClear(true)} disabled={streaming}><Trash2 size={14} /> New chat</button>
        )}
      </div>

      <div className="chat-log">
        {messages.length === 0 && (
          <motion.div className="chat-welcome" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <div className="bubble bot">
              <Markdown text={`Hi ${firstName}! 💗 I’m **Cupid**, the AI ${settings.fromName} built into your universe. I can write you poems, cheer you up, dream up date ideas, help with anything at all, or just keep you company. What’s on your mind?`} />
            </div>
            <div className="chips">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="chip-btn" onClick={() => send(s)} disabled={!enabled}><Sparkles size={13} /> {s}</button>
              ))}
            </div>
          </motion.div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <motion.div key={i} className={`msg ${m.role === 'user' ? 'me' : 'bot'}`}
              initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}>
              {m.role === 'assistant' && <div className="cupid-avatar">💘</div>}
              <div className={`bubble ${m.role === 'user' ? 'me' : 'bot'} ${m.error ? 'error' : ''}`}>
                {m.pending && !m.content ? (
                  <span className="typing"><i /><i /><i /></span>
                ) : m.role === 'user' ? (
                  <p>{m.content}</p>
                ) : (
                  <Markdown text={m.content} />
                )}
                {m.error && i === messages.length - 1 && (
                  <button className="btn small" onClick={retry} style={{ marginTop: 8 }}><RotateCcw size={13} /> Try again</button>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={endRef} />
      </div>

      <form className="chat-input card" onSubmit={(e) => { e.preventDefault(); send(input); }}>
        <textarea
          ref={inputRef}
          rows={1}
          value={input}
          maxLength={4000}
          disabled={!enabled}
          placeholder={enabled ? `Talk to Cupid, ${firstName}…` : 'Cupid is asleep. Add a GROQ_API_KEY to the .env file to wake him up.'}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send(input);
            }
          }}
        />
        {streaming ? (
          <button type="button" className="send stop" onClick={() => abort.current?.abort()} aria-label="Stop"><Square size={15} fill="currentColor" /></button>
        ) : (
          <button className="send" disabled={!input.trim() || !enabled} aria-label="Send"><ArrowUp size={19} /></button>
        )}
      </form>
      <p className="chat-foot">Cupid is an AI, so it can make mistakes. Your chats stay private on this device.</p>

      <Confirm open={confirmClear} title="Start a new chat?" text="This conversation will be cleared from this device."
        confirmLabel="Clear chat" danger onConfirm={() => { setMessages([]); persist([]); }} onClose={() => setConfirmClear(false)} />
    </main>
  );
}
