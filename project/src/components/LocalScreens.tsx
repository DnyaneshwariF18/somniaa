import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Archive, Bell, Check, Download, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { createLocalId, exportLocalData } from '@/localData';
import type {
  LocalData,
  LocalDecision,
  LocalMemory,
  LocalReminder,
} from '@/localData';
import { THEMES } from '@/themes';
import {
  approveMemory,
  createMemory,
  deleteMemory,
  editMemory as apiEditMemory,
  getMemoryContradictions,
  listMemories,
  type ApiStatus,
  type MemoryContradictionItem,
} from '@/api';

interface ScreenProps {
  data: LocalData;
  update: (updater: LocalData | ((previous: LocalData) => LocalData)) => void;
  storageError: string | null;
  apiStatus: ApiStatus | null;
  runSleepCycle: () => Promise<void>;
}

function StorageNotice({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p className="surface-card p-4 text-sm text-rose-200" role="alert">
      {error}
    </p>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline = false,
  type = 'text',
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  type?: string;
  required?: boolean;
}) {
  const className =
    'glass-input w-full rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/40';
  return (
    <label className="flex flex-col gap-2 text-sm text-white/80">
      {label}
      {multiline ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required={required}
          rows={3}
          className={`${className} resize-y`}
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required={required}
          type={type}
          className={className}
        />
      )}
    </label>
  );
}

function PrimaryButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`rounded-full px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50 ${props.className ?? ''}`}
      style={{ background: 'linear-gradient(135deg, var(--accent), var(--orb-halo))' }}
    >
      {children}
    </button>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <section className="surface-card p-5 sm:p-6">{children}</section>;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function toLocalDateTimeValue(value: string) {
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

export function MemoriesScreen({ data, update, storageError }: ScreenProps) {
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Sync latest memories from backend if available
  useEffect(() => {
    let active = true;
    void listMemories()
      .then((memories) => {
        if (active && Array.isArray(memories) && memories.length > 0) {
          update((previous) => {
            const prevIds = previous.memories.map((m) => m.id).join(',');
            const nextIds = memories.map((m) => m.id).join(',');
            if (prevIds !== nextIds || JSON.stringify(previous.memories) !== JSON.stringify(memories)) {
              return { ...previous, memories };
            }
            return previous;
          });
        }
      })
      .catch(() => {
        // Keep existing cached memories if backend is unavailable
      });
    return () => {
      active = false;
    };
  }, [update]);

  const visible = useMemo(
    () =>
      data.memories.filter((memory) =>
        memory.text.toLowerCase().includes(search.trim().toLowerCase()),
      ),
    [data.memories, search],
  );

  const addMemory = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    setActionError(null);
    try {
      const created = await createMemory(trimmed);
      update((previous) => ({
        ...previous,
        memories: [created, ...previous.memories.filter((m) => m.id !== created.id)],
      }));
      setText('');
    } catch (err) {
      // Fallback to local creation for offline resilience
      const now = new Date().toISOString();
      const memory: LocalMemory = {
        id: createLocalId(),
        text: trimmed,
        createdAt: now,
        updatedAt: now,
        status: 'approved',
      };
      update((previous) => ({ ...previous, memories: [memory, ...previous.memories] }));
      setText('');
      if (err instanceof Error && !err.message.includes('unavailable')) {
        setActionError(err.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const editMemory = async (memory: LocalMemory) => {
    const value = window.prompt('Edit this memory:', memory.text);
    if (value === null || !value.trim()) return;
    const trimmed = value.trim();
    setActionError(null);
    try {
      const updated = await apiEditMemory(memory.id, { text: trimmed });
      update((previous) => ({
        ...previous,
        memories: previous.memories.map((item) =>
          item.id === memory.id ? updated : item,
        ),
      }));
    } catch {
      update((previous) => ({
        ...previous,
        memories: previous.memories.map((item) =>
          item.id === memory.id
            ? { ...item, text: trimmed, updatedAt: new Date().toISOString() }
            : item,
        ),
      }));
    }
  };

  const handleApprove = async (memory: LocalMemory) => {
    setActionError(null);
    try {
      const updated = await approveMemory(memory.id);
      update((previous) => ({
        ...previous,
        memories: previous.memories.map((item) =>
          item.id === memory.id ? updated : item,
        ),
      }));
    } catch {
      update((previous) => ({
        ...previous,
        memories: previous.memories.map((item) =>
          item.id === memory.id
            ? { ...item, status: 'approved', updatedAt: new Date().toISOString() }
            : item,
        ),
      }));
    }
  };

  const handleArchive = async (memory: LocalMemory) => {
    setActionError(null);
    try {
      const updated = await apiEditMemory(memory.id, { status: 'archived' });
      update((previous) => ({
        ...previous,
        memories: previous.memories.map((item) =>
          item.id === memory.id ? updated : item,
        ),
      }));
    } catch {
      update((previous) => ({
        ...previous,
        memories: previous.memories.map((item) =>
          item.id === memory.id
            ? { ...item, status: 'archived', updatedAt: new Date().toISOString() }
            : item,
        ),
      }));
    }
  };

  const removeMemory = async (id: string) => {
    setActionError(null);
    try {
      await deleteMemory(id);
    } catch {
      // Continue with local removal
    }
    update((previous) => ({
      ...previous,
      memories: previous.memories.filter((item) => item.id !== id),
    }));
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Memories" subtitle="Things you chose to save on this device." />
      <StorageNotice error={storageError ?? actionError} />
      <Card>
        <form onSubmit={addMemory} className="flex flex-col gap-4">
          <Field label="Add a memory" value={text} onChange={setText} multiline required />
          <div className="flex justify-end">
            <PrimaryButton type="submit" disabled={!text.trim() || saving}>
              <span className="inline-flex items-center gap-2">
                <Plus size={16} /> {saving ? 'Saving...' : 'Save memory'}
              </span>
            </PrimaryButton>
          </div>
        </form>
      </Card>
      <Field label="Search memories" value={search} onChange={setSearch} />
      {visible.length === 0 ? (
        <Card>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {search ? 'No memories match your search.' : 'No saved memories yet. Memories are never created automatically.'}
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((memory) => (
            <Card key={memory.id}>
              <div className="flex items-start justify-between gap-3">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/90">{memory.text}</p>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide ${
                    memory.status === 'approved'
                      ? 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
                      : 'border border-amber-500/30 bg-amber-500/15 text-amber-300'
                  }`}
                >
                  {memory.status === 'approved' ? 'Approved' : 'Archived'}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs" style={{ color: 'var(--text-faint)' }}>
                  Added {formatDate(memory.createdAt)} · User-provided
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {memory.status === 'archived' ? (
                    <button
                      className="glass inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs text-emerald-300 hover:text-emerald-200"
                      onClick={() => handleApprove(memory)}
                      title="Approve memory for chat context"
                    >
                      <Check size={13} /> Approve
                    </button>
                  ) : (
                    <button
                      className="glass inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs text-amber-300 hover:text-amber-200"
                      onClick={() => handleArchive(memory)}
                      title="Archive memory to exclude from chat context"
                    >
                      <Archive size={13} /> Archive
                    </button>
                  )}
                  <button className="glass rounded-full px-3 py-1.5 text-xs" onClick={() => editMemory(memory)}>
                    Edit
                  </button>
                  <button
                    className="glass inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs text-rose-200"
                    onClick={() => removeMemory(memory.id)}
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export function RemindersScreen({ data, update, storageError }: ScreenProps) {
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [filter, setFilter] = useState<'upcoming' | 'completed'>('upcoming');
  const [editId, setEditId] = useState<string | null>(null);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission | 'unsupported'>('default');

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifPerm(Notification.permission);
    } else {
      setNotifPerm('unsupported');
    }
  }, []);

  const requestNotifPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const perm = await Notification.requestPermission();
      setNotifPerm(perm);
    }
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const reminder: LocalReminder = {
      id: editId ?? createLocalId(),
      title: title.trim(),
      details: details.trim(),
      dueAt: new Date(dueAt).toISOString(),
      completedAt: null,
      createdAt: new Date().toISOString(),
    };
    update((previous) => ({
      ...previous,
      reminders: editId
        ? previous.reminders.map((item) =>
            item.id === editId ? { ...item, ...reminder, completedAt: item.completedAt } : item,
          )
        : [reminder, ...previous.reminders],
    }));
    setTitle('');
    setDetails('');
    setDueAt('');
    setEditId(null);
  };

  const startEdit = (reminder: LocalReminder) => {
    setEditId(reminder.id);
    setTitle(reminder.title);
    setDetails(reminder.details);
    setDueAt(toLocalDateTimeValue(reminder.dueAt));
  };
  const visible = data.reminders
    .filter((item) => (filter === 'completed') === Boolean(item.completedAt))
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Reminders" subtitle="Saved to this device; no cloud account needed." />
      <StorageNotice error={storageError} />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs">
        <div className="flex items-center gap-2 text-white/80">
          <Bell size={15} className="text-[color:var(--accent)]" />
          <span>
            {notifPerm === 'granted'
              ? 'Desktop notifications are active for this browser.'
              : notifPerm === 'denied'
                ? 'Desktop notifications are blocked in browser settings.'
                : 'Enable desktop notifications to receive alerts when reminders become due.'}
          </span>
        </div>
        {notifPerm === 'default' && (
          <button
            onClick={() => void requestNotifPermission()}
            className="glass rounded-full px-3 py-1.5 font-medium text-white hover:text-white"
          >
            Enable Notifications
          </button>
        )}
      </div>

      <Card>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" value={title} onChange={setTitle} required />
          <Field label="Date and time" type="datetime-local" value={dueAt} onChange={setDueAt} required />
          <div className="sm:col-span-2">
            <Field label="Details (optional)" value={details} onChange={setDetails} multiline />
          </div>
          <div className="flex items-center justify-end gap-2 sm:col-span-2">
            {editId && (
              <button
                type="button"
                className="glass rounded-full px-4 py-2 text-sm"
                onClick={() => {
                  setEditId(null);
                  setTitle('');
                  setDetails('');
                  setDueAt('');
                }}
              >
                Cancel
              </button>
            )}
            <PrimaryButton type="submit" disabled={!title.trim() || !dueAt}>
              {editId ? 'Save changes' : 'Add reminder'}
            </PrimaryButton>
          </div>
        </form>
      </Card>
      <div className="flex gap-2">
        {(['upcoming', 'completed'] as const).map((value) => (
          <button
            key={value}
            className={`rounded-full px-4 py-2 text-sm ${filter === value ? 'chip' : 'glass'}`}
            onClick={() => setFilter(value)}
          >
            {value === 'upcoming' ? 'Upcoming' : 'Completed'}
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <Card><p className="text-sm" style={{ color: 'var(--text-muted)' }}>No {filter} reminders.</p></Card>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((reminder) => {
            const isOverdue = !reminder.completedAt && Date.parse(reminder.dueAt) < Date.now();
            return (
              <Card key={reminder.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-medium text-white">{reminder.title}</h2>
                      {isOverdue && (
                        <span className="rounded-full bg-rose-500/20 border border-rose-500/30 px-2 py-0.5 text-[10px] font-semibold text-rose-300">
                          Overdue
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs" style={{ color: isOverdue ? '#fca5a5' : 'var(--text-muted)' }}>
                      {formatDate(reminder.dueAt)}
                    </p>
                    {reminder.details && <p className="mt-3 whitespace-pre-wrap text-sm text-white/80">{reminder.details}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!reminder.completedAt && (
                      <>
                        <button className="glass rounded-full px-3 py-1.5 text-xs" onClick={() => startEdit(reminder)}>Edit</button>
                        <button
                          className="glass rounded-full px-3 py-1.5 text-xs text-emerald-300 hover:text-emerald-200"
                          onClick={() => update((previous) => ({
                            ...previous,
                            reminders: previous.reminders.map((item) =>
                              item.id === reminder.id ? { ...item, completedAt: new Date().toISOString() } : item,
                            ),
                          }))}
                        >
                          Complete
                        </button>
                      </>
                    )}
                    {reminder.completedAt && (
                      <button
                        className="glass rounded-full px-3 py-1.5 text-xs"
                        onClick={() => update((previous) => ({
                          ...previous,
                          reminders: previous.reminders.map((item) =>
                            item.id === reminder.id ? { ...item, completedAt: null } : item,
                          ),
                        }))}
                      >
                        Reopen
                      </button>
                    )}
                    <button
                      aria-label={`Delete ${reminder.title}`}
                      className="glass rounded-full px-3 py-1.5 text-xs text-rose-200"
                      onClick={() => update((previous) => ({
                        ...previous,
                        reminders: previous.reminders.filter((item) => item.id !== reminder.id),
                      }))}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
        Reminders trigger in-app alerts and desktop notifications while this browser tab is active.
      </p>
    </div>
  );
}

const emptyDecision = (): Omit<LocalDecision, 'id' | 'createdAt' | 'updatedAt'> => ({
  title: '',
  context: '',
  options: '',
  reasoning: '',
  expectedOutcome: '',
  reviewDate: '',
  actualOutcome: '',
  lesson: '',
});

export function DecisionJournalScreen({ data, update, storageError }: ScreenProps) {
  const [form, setForm] = useState(emptyDecision);
  const [search, setSearch] = useState('');

  const setField = (field: keyof ReturnType<typeof emptyDecision>, value: string) =>
    setForm((previous) => ({ ...previous, [field]: value }));

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const now = new Date().toISOString();
    const decision: LocalDecision = { ...form, id: createLocalId(), createdAt: now, updatedAt: now };
    update((previous) => ({ ...previous, decisions: [decision, ...previous.decisions] }));
    setForm(emptyDecision());
  };

  const visible = data.decisions.filter((decision) =>
    `${decision.title} ${decision.context} ${decision.reasoning}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Decision Journal" subtitle="Record what you decided and review what happened." />
      <StorageNotice error={storageError} />
      <Card>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <Field label="Decision" value={form.title} onChange={(value) => setField('title', value)} required />
          <Field label="Review date (optional)" type="date" value={form.reviewDate} onChange={(value) => setField('reviewDate', value)} />
          <Field label="Context" value={form.context} onChange={(value) => setField('context', value)} multiline />
          <Field label="Options considered" value={form.options} onChange={(value) => setField('options', value)} multiline />
          <Field label="Reasoning" value={form.reasoning} onChange={(value) => setField('reasoning', value)} multiline />
          <Field label="Expected outcome" value={form.expectedOutcome} onChange={(value) => setField('expectedOutcome', value)} multiline />
          <div className="flex justify-end sm:col-span-2">
            <PrimaryButton type="submit" disabled={!form.title.trim()}>Save decision</PrimaryButton>
          </div>
        </form>
      </Card>
      <Field label="Search journal" value={search} onChange={setSearch} />
      {visible.length === 0 ? (
        <Card><p className="text-sm" style={{ color: 'var(--text-muted)' }}>No matching decisions yet.</p></Card>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((decision) => (
            <DecisionCard key={decision.id} decision={decision} update={update} />
          ))}
        </div>
      )}
    </div>
  );
}

function DecisionCard({ decision, update }: { decision: LocalDecision; update: ScreenProps['update'] }) {
  const [outcome, setOutcome] = useState(decision.actualOutcome);
  const [lesson, setLesson] = useState(decision.lesson);
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-medium text-white">{decision.title}</h2>
          <p className="mt-1 text-xs" style={{ color: 'var(--text-faint)' }}>Recorded {formatDate(decision.createdAt)}</p>
        </div>
        <button
          aria-label={`Delete ${decision.title}`}
          className="glass rounded-full p-2 text-rose-200"
          onClick={() => update((previous) => ({
            ...previous,
            decisions: previous.decisions.filter((item) => item.id !== decision.id),
          }))}
        >
          <Trash2 size={15} />
        </button>
      </div>
      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        {[
          ['Context', decision.context],
          ['Options', decision.options],
          ['Reasoning', decision.reasoning],
          ['Expected outcome', decision.expectedOutcome],
        ].filter(([, value]) => value).map(([label, value]) => (
          <p key={label} className="whitespace-pre-wrap text-white/75"><strong className="text-white/90">{label}: </strong>{value}</p>
        ))}
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Actual outcome" value={outcome} onChange={setOutcome} multiline />
        <Field label="Lesson learned" value={lesson} onChange={setLesson} multiline />
        <div className="sm:col-span-2 sm:text-right">
          <button
            className="glass rounded-full px-4 py-2 text-xs"
            onClick={() => update((previous) => ({
              ...previous,
              decisions: previous.decisions.map((item) =>
                item.id === decision.id
                  ? { ...item, actualOutcome: outcome, lesson, updatedAt: new Date().toISOString() }
                  : item,
              ),
            }))}
          >
            Save review
          </button>
        </div>
      </div>
    </Card>
  );
}

export function SettingsScreen({
  data,
  update,
  storageError,
  apiStatus,
  clearData,
}: ScreenProps & { clearData: () => void }) {
  const download = () => {
    const file = new Blob([exportLocalData(data)], { type: 'application/json' });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'somnia-data.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Settings & Privacy" subtitle="Your data is stored locally on this device." />
      <StorageNotice error={storageError} />
      <Card>
        <h2 className="mb-3 text-base font-medium text-white">Appearance</h2>
        <div className="flex flex-wrap gap-2">
          {THEMES.map((theme) => (
            <button
              key={theme.id}
              className={`rounded-full px-4 py-2 text-sm ${data.theme === theme.id ? 'chip' : 'glass'}`}
              onClick={() => update((previous) => ({ ...previous, theme: theme.id }))}
            >
              {theme.label}
            </button>
          ))}
        </div>
      </Card>
      <Card>
        <h2 className="text-base font-medium text-white">Local data and privacy</h2>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          Chat, memories, reminders, and journal entries are stored in a local SQLite database and cached in this browser.
          Somnia does not encrypt this local data or sync it to another device. Anyone with access to this device may be able
          to read it. Export your data before deleting it.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={download}
            disabled={Boolean(storageError)}
            className="glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download size={15} /> Export my data
          </button>
          <button
            onClick={() => {
              if (window.confirm('Delete all Somnia data saved by this local app? This cannot be undone.')) clearData();
            }}
            className="glass rounded-full px-4 py-2 text-sm text-rose-200"
          >
            Delete all Somnia data
          </button>
        </div>
      </Card>
      <Card>
        <h2 className="text-base font-medium text-white">AI data sharing</h2>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          {!apiStatus
            ? 'The backend status is unavailable. Chat cannot reach the local service.'
            : apiStatus.llm.configured
              ? `An OpenAI-compatible provider is configured on the backend (${apiStatus.llm.model}).`
              : 'No AI provider is configured. Chat stays in clearly labelled demo mode.'}
          {' '}If enabled, Somnia sends your message, a small recent chat window, and only relevant approved memories or recorded decisions to that provider.
          The provider processes this data under its own terms.
        </p>
        <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm text-white/85">
          <input
            type="checkbox"
            checked={data.allowExternalAI}
            onChange={(event) => update((previous) => ({
              ...previous,
              allowExternalAI: event.target.checked,
            }))}
            className="mt-1 accent-[color:var(--accent)]"
          />
          <span>
            I allow Somnia to send chat context and relevant approved records to the configured external AI provider.
            {data.allowExternalAI && !apiStatus?.llm.configured && (
              <span className="mt-1 block text-xs text-amber-200">Consent is saved, but no provider is configured; Somnia will remain in demo mode.</span>
            )}
          </span>
        </label>
        <p className="mt-4 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          Reminders trigger in-app alerts and desktop notifications while this browser tab is active. Automated Sleep Cycle runs daily on the backend to review memory freshness.
        </p>
      </Card>
    </div>
  );
}

export function SleepCycleScreen({ data, storageError, apiStatus, runSleepCycle }: ScreenProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const latest = data.sleepRuns[0];
  const staleIds = new Set(latest?.staleMemoryIds ?? []);
  const staleMemories = data.memories.filter((memory) => staleIds.has(memory.id));

  const run = async () => {
    setIsRunning(true);
    setRunError(null);
    try {
      await runSleepCycle();
    } catch (reason) {
      setRunError(reason instanceof Error ? reason.message : 'Sleep Cycle could not run.');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Sleep Cycle" subtitle="A backend job reviews approved memories for staleness." />
      <StorageNotice error={storageError} />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
        <div className="flex items-center gap-2.5 text-xs">
          <span className="relative flex h-2.5 w-2.5">
            {apiStatus?.scheduledJobs && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            )}
            <span
              className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                apiStatus?.scheduledJobs ? 'bg-emerald-400' : 'bg-zinc-500'
              }`}
            />
          </span>
          <span className="font-medium text-white/90">
            {apiStatus?.scheduledJobs
              ? 'Automatic Background Scheduler: Active (Daily 24h review)'
              : 'Automatic Background Scheduler: Inactive'}
          </span>
        </div>
        <span className="text-[11px] text-white/60">
          Backend SQLite Job
        </span>
      </div>

      <Card>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          This backend job flags approved memories not updated in over 180 days. Repeating the request is safe due to idempotency keys.
          The automated scheduler periodically checks in the background.
        </p>
        {runError && <p className="mt-3 text-sm text-rose-200" role="alert">{runError}</p>}
        <PrimaryButton className="mt-4" onClick={() => void run()} disabled={isRunning}>
          {isRunning ? 'Running review…' : 'Run memory review'}
        </PrimaryButton>
      </Card>
      {!latest ? (
        <Card><p className="text-sm" style={{ color: 'var(--text-muted)' }}>No review has been run yet.</p></Card>
      ) : (
        <Card>
          <h2 className="font-medium text-white">Last run: {formatDate(latest.startedAt)}</h2>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            Completed local check · {staleMemories.length} saved {staleMemories.length === 1 ? 'memory may need' : 'memories may need'} review.
          </p>
          {staleMemories.length > 0 && (
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-white/80">
              {staleMemories.map((memory) => <li key={memory.id}>{memory.text}</li>)}
            </ul>
          )}
        </Card>
      )}
      {data.sleepRuns.length > 1 && (
        <Card>
          <h2 className="mb-3 font-medium text-white">Previous runs</h2>
          <ul className="space-y-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            {data.sleepRuns.slice(1).map((item) => (
              <li key={item.id}>{formatDate(item.startedAt)} · {item.staleMemoryIds.length} possible stale memories</li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

export function MorningReportScreen({ data, update, storageError, apiStatus }: ScreenProps) {
  const [contradictions, setContradictions] = useState<MemoryContradictionItem[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);

  const latest = data.sleepRuns[0];
  const staleIds = new Set(latest?.staleMemoryIds ?? []);
  const staleMemories = data.memories.filter((memory) => staleIds.has(memory.id));

  useEffect(() => {
    let active = true;
    void getMemoryContradictions()
      .then((res) => {
        if (active && Array.isArray(res.contradictions)) {
          setContradictions(res.contradictions);
        }
      })
      .catch(() => {
        // Fallback: contradictions remain empty if offline
      });
    return () => {
      active = false;
    };
  }, [data.memories]);

  const handleKeepMemory = async (kept: LocalMemory, archived: LocalMemory) => {
    setActionError(null);
    try {
      await apiEditMemory(archived.id, { status: 'archived' });
      update((previous) => ({
        ...previous,
        memories: previous.memories.map((m) =>
          m.id === archived.id ? { ...m, status: 'archived', updatedAt: new Date().toISOString() } : m,
        ),
      }));
      setContradictions((prev) =>
        prev.filter((c) => c.memoryA.id !== archived.id && c.memoryB.id !== archived.id),
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to archive conflicting memory.');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Morning Report" subtitle="A summary of the latest Sleep Cycle and memory consistency check." />
      <StorageNotice error={storageError} />
      {actionError && (
        <p className="surface-card p-4 text-sm text-rose-200" role="alert">
          {actionError}
        </p>
      )}

      {/* Scheduler Status */}
      <div className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs">
        <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
        <span className="text-white/80">
          Automated Daily Staleness Review:{' '}
          <strong className="text-white font-medium">
            {apiStatus?.scheduledJobs ? 'Active & Monitored' : 'Manual Trigger Only'}
          </strong>
        </span>
      </div>

      {/* Contradiction Detection Section */}
      {contradictions.length > 0 && (
        <Card>
          <div className="flex items-center gap-2 text-amber-300 mb-2">
            <AlertTriangle size={18} />
            <h2 className="font-medium text-white text-base">Memory Contradiction Review</h2>
          </div>
          <p className="text-sm text-white/70 mb-4 leading-relaxed">
            Somnia detected {contradictions.length} conflicting {contradictions.length === 1 ? 'pair' : 'pairs'} among your approved memories.
            Select which fact to retain as current:
          </p>
          <div className="space-y-4">
            {contradictions.map((c, idx) => (
              <div key={idx} className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                <p className="text-xs font-semibold text-amber-200 mb-3">{c.reason}</p>
                <div className="grid gap-3 sm:grid-cols-2 text-sm text-white/90">
                  <div className="rounded-lg bg-black/40 p-3.5 border border-white/10 flex flex-col justify-between">
                    <div>
                      <p className="text-xs text-white/50 mb-1.5">Memory 1 · Added {formatDate(c.memoryA.createdAt)}</p>
                      <p className="font-medium leading-relaxed">"{c.memoryA.text}"</p>
                    </div>
                    <button
                      onClick={() => void handleKeepMemory(c.memoryA, c.memoryB)}
                      className="mt-3.5 inline-flex items-center justify-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/30 transition-colors"
                    >
                      <Check size={13} /> Keep Memory 1 (Archive Memory 2)
                    </button>
                  </div>
                  <div className="rounded-lg bg-black/40 p-3.5 border border-white/10 flex flex-col justify-between">
                    <div>
                      <p className="text-xs text-white/50 mb-1.5">Memory 2 · Added {formatDate(c.memoryB.createdAt)}</p>
                      <p className="font-medium leading-relaxed">"{c.memoryB.text}"</p>
                    </div>
                    <button
                      onClick={() => void handleKeepMemory(c.memoryB, c.memoryA)}
                      className="mt-3.5 inline-flex items-center justify-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/30 transition-colors"
                    >
                      <Check size={13} /> Keep Memory 2 (Archive Memory 1)
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {!latest ? (
        <Card>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            There is no Sleep Cycle report yet. Run Sleep Cycle to inspect memory staleness.
          </p>
        </Card>
      ) : (
        <Card>
          <h2 className="font-medium text-white">Review from {formatDate(latest.startedAt)}</h2>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            The rules-based staleness check found {staleMemories.length} memory {staleMemories.length === 1 ? 'to review' : 'items to review'}.
          </p>
          {staleMemories.map((memory) => (
            <div className="mt-4 rounded-xl border border-white/10 p-4" key={memory.id}>
              <p className="text-sm text-white/85">{memory.text}</p>
              <p className="mt-2 text-xs" style={{ color: 'var(--text-faint)' }}>
                Last updated {formatDate(memory.updatedAt)} · Review or edit in Memories screen.
              </p>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
