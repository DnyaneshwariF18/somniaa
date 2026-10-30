import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, Moon, Send, Plus, Sparkles } from 'lucide-react';
import { getDemoReply, SUGGESTIONS } from '@/chatResponses';
import { createMemory, editMemory, type ApiStatus, type ChatProposalConflict, type ChatResponse } from '@/api';
import type { LocalMemory } from '@/localData';

export type ChatRole = 'user' | 'somnia';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
}

export interface MemoryProposalItem {
  id: string;
  text: string;
  status: 'pending' | 'approved' | 'dismissed';
  conflict?: ChatProposalConflict;
}

interface ChatProps {
  messages: ChatMessage[];
  apiStatus: ApiStatus | null;
  onSendMessage: (
    text: string,
    history: ChatMessage[],
  ) => Promise<ChatResponse>;
  onMessagesChange: (
    updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[]),
  ) => void;
  onMemorySaved?: (memory: LocalMemory) => void;
}

const nextId = () => crypto.randomUUID();

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

function WelcomeScreen({
  onSuggestion,
  modeLabel,
}: {
  onSuggestion: (text: string) => void;
  modeLabel: string;
}) {
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
        {modeLabel}
      </p>
    </div>
  );
}

export default function Chat({
  messages,
  apiStatus,
  onSendMessage,
  onMessagesChange,
  onMemorySaved,
}: ChatProps) {
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [responseMode, setResponseMode] = useState<'ai' | 'demo' | null>(null);
  const [proposals, setProposals] = useState<MemoryProposalItem[]>([]);
  const [savingProposalId, setSavingProposalId] = useState<string | null>(null);
  const replyCounter = useRef(0);
  const requestGeneration = useRef(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const isEmpty = input.trim().length === 0;
  const canSend = !isEmpty && !isTyping;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isTyping, proposals]);

  const send = async (raw: string) => {
    const text = raw.trim();
    if (!text || isTyping) return;
    const generation = requestGeneration.current;
    const userMessage = { id: nextId(), role: 'user' as const, text };
    const history = [...messages, userMessage];
    onMessagesChange((prev) => [...prev, userMessage]);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setIsTyping(true);
    setSendError(null);
    try {
      const result = await onSendMessage(text, history.slice(-8));
      replyCounter.current += 1;
      const replyText = result.mode === 'demo'
        ? getDemoReply(text, replyCounter.current).text
        : result.text;
      if (!replyText) throw new Error('Somnia received an empty response.');
      if (requestGeneration.current !== generation) return;
      setResponseMode(result.mode);
      onMessagesChange((prev) => [...prev, { id: nextId(), role: 'somnia', text: replyText }]);

      if (Array.isArray(result.proposals) && result.proposals.length > 0) {
        const newItems: MemoryProposalItem[] = result.proposals.map((propText) => {
          const conflict = result.conflicts?.find((c) => c.proposal === propText);
          return {
            id: nextId(),
            text: propText,
            status: 'pending',
            conflict,
          };
        });
        setProposals((prev) => [...prev, ...newItems]);
      }
    } catch (reason) {
      if (requestGeneration.current === generation) {
        setSendError(reason instanceof Error ? reason.message : 'Somnia could not send your message.');
      }
    } finally {
      if (requestGeneration.current === generation) setIsTyping(false);
    }
  };

  const handleApproveProposal = async (proposal: MemoryProposalItem) => {
    if (savingProposalId) return;
    setSavingProposalId(proposal.id);
    try {
      const created = await createMemory(proposal.text);
      onMemorySaved?.(created);
      setProposals((prev) =>
        prev.map((p) => (p.id === proposal.id ? { ...p, status: 'approved' } : p)),
      );
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Could not save approved memory.');
    } finally {
      setSavingProposalId(null);
    }
  };

  const handleReplaceMemory = async (proposal: MemoryProposalItem) => {
    if (savingProposalId || !proposal.conflict?.existingMemoryId) return;
    setSavingProposalId(proposal.id);
    try {
      const updated = await editMemory(proposal.conflict.existingMemoryId, {
        text: proposal.text,
        status: 'approved',
      });
      onMemorySaved?.(updated);
      setProposals((prev) =>
        prev.map((p) => (p.id === proposal.id ? { ...p, status: 'approved' } : p)),
      );
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Could not update existing memory.');
    } finally {
      setSavingProposalId(null);
    }
  };

  const handleDismissProposal = (proposalId: string) => {
    setProposals((prev) =>
      prev.map((p) => (p.id === proposalId ? { ...p, status: 'dismissed' } : p)),
    );
  };

  const handleSuggestion = (text: string) => {
    send(text);
  };

  const handleNewChat = () => {
    requestGeneration.current += 1;
    setIsTyping(false);
    setInput('');
    setSendError(null);
    setProposals([]);
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
  const modeLabel = !apiStatus
    ? 'Backend unavailable. Start the local backend to send messages.'
    : apiStatus.llm.mode === 'ai'
      ? 'AI responses use only the context described in Settings & Privacy.'
      : 'Demo responses are illustrative and are not generated by a real AI model.';
  const footerLabel = responseMode
    ? responseMode === 'ai'
      ? 'Response generated by the configured AI provider'
      : 'Demo response · illustrative only'
    : apiStatus
      ? apiStatus.llm.mode === 'ai'
        ? 'AI provider enabled · external sharing is described in Settings & Privacy'
        : 'Demo mode · no external AI request'
      : 'Backend unavailable';

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
              {!apiStatus
                ? 'Backend unavailable · browser cache only'
                : apiStatus.llm.mode === 'ai'
                  ? `AI connected · ${apiStatus.llm.model}`
                  : 'Demo mode · no external AI request'}
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
          <WelcomeScreen onSuggestion={handleSuggestion} modeLabel={modeLabel} />
        ) : (
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            {isTyping && <TypingIndicator />}
            {proposals
              .filter((p) => p.status !== 'dismissed')
              .map((proposal) => (
                <div
                  key={proposal.id}
                  className="fade-in w-full rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 shadow-lg backdrop-blur-sm transition-all"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/20 text-amber-300">
                        <Sparkles size={13} />
                      </span>
                      <span className="text-xs font-semibold tracking-wide text-amber-300 uppercase">
                        Memory Proposal
                      </span>
                    </div>
                    {proposal.status === 'approved' && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/20 px-3 py-0.5 text-xs font-medium text-emerald-300">
                        <Check size={12} /> Approved & Saved
                      </span>
                    )}
                  </div>

                  <p className="mt-2 text-sm leading-relaxed text-white/95 font-medium">
                    "{proposal.text}"
                  </p>

                  {proposal.conflict && (
                    <div className="mt-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-200">
                      <div className="flex items-center gap-1.5 font-medium text-amber-300">
                        <AlertTriangle size={13} className="shrink-0" />
                        <span>Potential Contradiction Detected</span>
                      </div>
                      <p className="mt-1 text-white/80">
                        Conflicts with saved memory: <span className="italic text-white">"{proposal.conflict.existingMemory}"</span>
                      </p>
                      <p className="mt-0.5 text-amber-300 font-medium">
                        {proposal.conflict.reason}
                      </p>
                    </div>
                  )}

                  {proposal.status === 'pending' ? (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/5">
                      <span className="text-xs text-white/60">
                        {proposal.conflict
                          ? 'Review contradiction before saving to memories:'
                          : 'Explicit fact detected in your message. Save to memories?'}
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => handleDismissProposal(proposal.id)}
                          disabled={savingProposalId === proposal.id}
                          className="glass rounded-full px-3 py-1.5 text-xs text-white/70 hover:text-white transition-colors"
                        >
                          Dismiss
                        </button>
                        {proposal.conflict?.existingMemoryId && (
                          <button
                            onClick={() => handleReplaceMemory(proposal)}
                            disabled={savingProposalId === proposal.id}
                            className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/20 px-3.5 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/30 transition-all disabled:opacity-50"
                            title="Replace the conflicting memory with this updated fact"
                          >
                            <Check size={13} />
                            {savingProposalId === proposal.id ? 'Replacing...' : 'Replace Existing'}
                          </button>
                        )}
                        <button
                          onClick={() => handleApproveProposal(proposal)}
                          disabled={savingProposalId === proposal.id}
                          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/20 px-3.5 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/30 transition-all disabled:opacity-50"
                        >
                          <Check size={13} />
                          {savingProposalId === proposal.id
                            ? 'Saving...'
                            : proposal.conflict
                              ? 'Approve Anyway'
                              : 'Approve Memory'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-emerald-300/80">
                      This memory is now approved and will be used as relevant context for future conversations.
                    </p>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="chat-composer">
        <div className="composer-inner">
          {sendError && (
            <p className="mb-2 rounded-xl border border-rose-300/20 bg-rose-400/10 px-4 py-2 text-sm text-rose-100" role="alert">
              {sendError}
            </p>
          )}
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
            Enter to send · Shift + Enter for a new line · {footerLabel}
          </p>
        </div>
      </div>
    </div>
  );
}
