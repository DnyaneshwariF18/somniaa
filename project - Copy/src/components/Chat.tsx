import { useEffect, useRef, useState } from 'react';
import { Moon, Send, Plus, Sparkles } from 'lucide-react';
import { getDemoReply, SUGGESTIONS } from '@/chatResponses';

export type ChatRole = 'user' | 'somnia';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
}

interface ChatProps {
  messages: ChatMessage[];
  onMessagesChange: (
    updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[]),
  ) => void;
}

let idCounter = 0;
const nextId = () => `msg-${++idCounter}`;

function TypingIndicator() {
  return (
    <div className="chat-avatar self-start">
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
        style={{
          background: 'rgba(var(--link), 0.14)',
          border: '1px solid rgba(var(--link), 0.22)',
        }}
      >
        <Moon size={14} className="text-[color:var(--accent)]" />
      </span>
      <div className="chat-bubble chat-bubble--somnia typing-dots" aria-label="Somnia is typing">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={`chat-avatar ${isUser ? 'self-end' : 'self-start'}`}>
      {!isUser && (
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
          style={{
            background: 'rgba(var(--link), 0.14)',
            border: '1px solid rgba(var(--link), 0.22)',
          }}
        >
          <Moon size={14} className="text-[color:var(--accent)]" />
        </span>
      )}
      <div className={`chat-bubble ${isUser ? 'chat-bubble--user' : 'chat-bubble--somnia'}`}>
        {message.text}
      </div>
    </div>
  );
}

function WelcomeScreen({ onSuggestion }: { onSuggestion: (text: string) => void }) {
  return (
    <div className="fade-in flex flex-1 flex-col items-center justify-center px-4 py-10 text-center">
      <span
        className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{
          background: 'rgba(var(--link), 0.14)',
          border: '1px solid rgba(var(--link), 0.26)',
          boxShadow: '0 0 28px rgba(var(--link), 0.18)',
        }}
      >
        <Moon size={30} className="text-[color:var(--accent)]" />
      </span>
      <h2 className="font-serif-italic text-3xl sm:text-4xl text-white mb-3">
        Your space to think clearly.
      </h2>
      <p
        className="max-w-md text-sm sm:text-base leading-relaxed mb-8"
        style={{ color: 'var(--text-muted)' }}
      >
        Ask a question, organize your thoughts, or plan your day. Somnia is here to
        help you find clarity — one step at a time.
      </p>

      <div className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onSuggestion(s)}
            className="suggestion-card flex items-center gap-3"
          >
            <Sparkles size={16} className="shrink-0 text-[color:var(--accent)]" />
            <span className="text-sm text-left text-white/90">{s}</span>
          </button>
        ))}
      </div>

      <p className="mt-8 text-[11px]" style={{ color: 'var(--text-faint)' }}>
        Simulated demo — responses are illustrative, not from a real AI model.
      </p>
    </div>
  );
}

export default function Chat({ messages, onMessagesChange }: ChatProps) {
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const replyCounter = useRef(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isEmpty = input.trim().length === 0;
  const canSend = !isEmpty && !isTyping;

  useEffect(() => {
    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isTyping]);

  const pushMessage = (role: ChatRole, text: string) => {
    onMessagesChange((prev) => [...prev, { id: nextId(), role, text }]);
  };

  const send = (raw: string) => {
    const text = raw.trim();
    if (!text || isTyping) return;
    pushMessage('user', text);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setIsTyping(true);

    replyCounter.current += 1;
    const reply = getDemoReply(text, replyCounter.current);
    const delay = 900 + Math.random() * 700;

    typingTimer.current = setTimeout(() => {
      onMessagesChange((prev) => [
        ...prev,
        { id: nextId(), role: 'somnia', text: reply.text },
      ]);
      setIsTyping(false);
    }, delay);
  };

  const handleSuggestion = (text: string) => {
    send(text);
  };

  const handleNewChat = () => {
    if (typingTimer.current) clearTimeout(typingTimer.current);
    setIsTyping(false);
    setInput('');
    onMessagesChange([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="chat-layout">
      {/* Header bar with New Chat */}
      <div className="app-header">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{
              background: 'rgba(var(--link), 0.14)',
              border: '1px solid rgba(var(--link), 0.22)',
            }}
          >
            <Moon size={18} className="text-[color:var(--accent)]" />
          </span>
          <div className="min-w-0">
            <h1 className="font-serif-italic text-2xl sm:text-3xl text-white leading-tight">
              Chat
            </h1>
            <p className="text-xs sm:text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Simulated assistant · demo mode
            </p>
          </div>
        </div>
        <button
          onClick={handleNewChat}
          className="glass flex items-center gap-2 rounded-full px-4 py-2 text-xs sm:text-sm text-white/85 hover:text-white transition-colors"
          aria-label="Start a new chat"
        >
          <Plus size={15} />
          <span className="hidden sm:inline">New Chat</span>
        </button>
      </div>

      {/* Conversation area */}
      <div className="chat-scroll" ref={scrollRef}>
        {!hasMessages ? (
          <WelcomeScreen onSuggestion={handleSuggestion} />
        ) : (
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            {isTyping && <TypingIndicator />}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="chat-composer">
        <div className="composer-inner">
          <div className="composer-field">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="Message SOMNIA..."
              className="composer-textarea"
              aria-label="Message Somnia"
            />
            <button
              onClick={() => send(input)}
              disabled={!canSend}
              className="send-btn"
              aria-label="Send message"
            >
              <Send size={17} />
            </button>
          </div>
          <p className="mt-2 text-center text-[11px]" style={{ color: 'var(--text-faint)' }}>
            Enter to send · Shift + Enter for a new line · Simulated demo responses
          </p>
        </div>
      </div>
    </div>
  );
}
