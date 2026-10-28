import { useMemo, useState } from 'react';
import { Download, Plus, Trash2 } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { createLocalId, exportLocalData } from '@/localData';
import type {
  LocalData,
  LocalDecision,
  LocalMemory,
  LocalReminder,
} from '@/localData';
import { THEMES } from '@/themes';
import type { ApiStatus } from '@/api';

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
  const visible = useMemo(
    () =>
      data.memories.filter((memory) =>
        memory.text.toLowerCase().includes(search.trim().toLowerCase()),
      ),
    [data.memories, search],
  );

  const addMemory = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const now = new Date().toISOString();
    const memory: LocalMemory = {
      id: createLocalId(),
      text: text.trim(),
      createdAt: now,
      updatedAt: now,
      status: 'approved',
    };
    update((previous) => ({ ...previous, memories: [memory, ...previous.memories] }));
    setText('');
  };

  const editMemory = (memory: LocalMemory) => {
    const value = window.prompt('Edit this memory:', memory.text);
    if (value === null || !value.trim()) return;
    update((previous) => ({
      ...previous,
      memories: previous.memories.map((item) =>
        item.id === memory.id
          ? { ...item, text: value.trim(), updatedAt: new Date().toISOString() }
          : item,
      ),
    }));
  };

  const removeMemory = (id: string) => {
    update((previous) => ({
      ...previous,
      memories: previous.memories.filter((item) => item.id !== id),
    }));
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Memories" subtitle="Things you chose to save on this device." />
      <StorageNotice error={storageError} />
      <Card>
        <form onSubmit={addMemory} className="flex flex-col gap-4">
          <Field label="Add a memory" value={text} onChange={setText} multiline required />
          <div className="flex justify-end">
            <PrimaryButton type="submit" disabled={!text.trim()}>
              <span className="inline-flex items-center gap-2"><Plus size={16} /> Save memory</span>
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
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/90">{memory.text}</p>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs" style={{ color: 'var(--text-faint)' }}>
                  Added {formatDate(memory.createdAt)} · User-provided
                </span>
                <div className="flex gap-2">
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
          {visible.map((reminder) => (
            <Card key={reminder.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-medium text-white">{reminder.title}</h2>
                  <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{formatDate(reminder.dueAt)}</p>
                  {reminder.details && <p className="mt-3 whitespace-pre-wrap text-sm text-white/80">{reminder.details}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {!reminder.completedAt && (
                    <>
                      <button className="glass rounded-full px-3 py-1.5 text-xs" onClick={() => startEdit(reminder)}>Edit</button>
                      <button
                        className="glass rounded-full px-3 py-1.5 text-xs"
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
          ))}
        </div>
      )}
      <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
        Reminders are not sent as notifications. This app cannot reliably alert you when it is closed.
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
          Reminders are stored but no notifications are sent; Somnia cannot alert you while it is closed. Scheduled Sleep Cycle jobs are not configured.
        </p>
      </Card>
    </div>
  );
}

export function SleepCycleScreen({ data, storageError, runSleepCycle }: ScreenProps) {
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
      <Card>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          This manual backend run flags approved memories not updated in over 180 days. It does not infer new facts or run automatically.
          Repeating the same request is safe; scheduled runs are not configured.
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

export function MorningReportScreen({ data, storageError }: ScreenProps) {
  const latest = data.sleepRuns[0];
  const staleIds = new Set(latest?.staleMemoryIds ?? []);
  const staleMemories = data.memories.filter((memory) => staleIds.has(memory.id));
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Morning Report" subtitle="A summary of the latest local Sleep Cycle check." />
      <StorageNotice error={storageError} />
      {!latest ? (
        <Card>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            There is no report yet. Run Sleep Cycle to create a report from an actual backend review.
          </p>
        </Card>
      ) : (
        <Card>
          <h2 className="font-medium text-white">Review from {formatDate(latest.startedAt)}</h2>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            The rules-based check found {staleMemories.length} memory {staleMemories.length === 1 ? 'to review' : 'items to review'}.
            No AI-generated proposals or replay evaluation were produced.
          </p>
          {staleMemories.map((memory) => (
            <div className="mt-4 rounded-xl border border-white/10 p-4" key={memory.id}>
              <p className="text-sm text-white/85">{memory.text}</p>
              <p className="mt-2 text-xs" style={{ color: 'var(--text-faint)' }}>
                Last updated {formatDate(memory.updatedAt)} · Review manually in Memories.
              </p>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
