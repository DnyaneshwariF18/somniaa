export interface LocalMessage {
  id: string;
  role: 'user' | 'somnia';
  text: string;
}

export interface LocalMemory {
  id: string;
  text: string;
  createdAt: string;
  updatedAt: string;
  status: 'approved' | 'archived';
}

export interface LocalReminder {
  id: string;
  title: string;
  details: string;
  dueAt: string;
  completedAt: string | null;
  createdAt: string;
}

export interface LocalDecision {
  id: string;
  title: string;
  context: string;
  options: string;
  reasoning: string;
  expectedOutcome: string;
  reviewDate: string;
  actualOutcome: string;
  lesson: string;
  createdAt: string;
  updatedAt: string;
}

export interface LocalSleepRun {
  id: string;
  startedAt: string;
  status: 'completed';
  staleMemoryIds: string[];
}

export interface LocalData {
  version: 1;
  messages: LocalMessage[];
  memories: LocalMemory[];
  reminders: LocalReminder[];
  decisions: LocalDecision[];
  sleepRuns: LocalSleepRun[];
  theme: 'somnia' | 'neural' | 'cosmic' | 'quantum';
  allowExternalAI: boolean;
}

const STORAGE_KEY = 'somnia.local-data.v1';
const CHANGE_EVENT = 'somnia-local-data-changed';

export const emptyLocalData = (): LocalData => ({
  version: 1,
  messages: [],
  memories: [],
  reminders: [],
  decisions: [],
  sleepRuns: [],
  theme: 'somnia',
  allowExternalAI: false,
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isLocalMessage(value: unknown): value is LocalMessage {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    (value.role === 'user' || value.role === 'somnia') &&
    typeof value.text === 'string'
  );
}

function isLocalMemory(value: unknown): value is LocalMemory {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.text === 'string' &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string' &&
    (value.status === 'approved' || value.status === 'archived')
  );
}

function isLocalReminder(value: unknown): value is LocalReminder {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.details === 'string' &&
    typeof value.dueAt === 'string' &&
    (typeof value.completedAt === 'string' || value.completedAt === null) &&
    typeof value.createdAt === 'string'
  );
}

function isLocalDecision(value: unknown): value is LocalDecision {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.context === 'string' &&
    typeof value.options === 'string' &&
    typeof value.reasoning === 'string' &&
    typeof value.expectedOutcome === 'string' &&
    typeof value.reviewDate === 'string' &&
    typeof value.actualOutcome === 'string' &&
    typeof value.lesson === 'string' &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  );
}

function isLocalSleepRun(value: unknown): value is LocalSleepRun {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.startedAt === 'string' &&
    value.status === 'completed' &&
    Array.isArray(value.staleMemoryIds) &&
    value.staleMemoryIds.every((id) => typeof id === 'string')
  );
}

function isLocalData(value: unknown): value is LocalData {
  if (!isRecord(value)) return false;
  const data = value;
  return (
    data.version === 1 &&
    Array.isArray(data.messages) &&
    data.messages.every(isLocalMessage) &&
    Array.isArray(data.memories) &&
    data.memories.every(isLocalMemory) &&
    Array.isArray(data.reminders) &&
    data.reminders.every(isLocalReminder) &&
    Array.isArray(data.decisions) &&
    data.decisions.every(isLocalDecision) &&
    Array.isArray(data.sleepRuns) &&
    data.sleepRuns.every(isLocalSleepRun) &&
    (data.theme === 'somnia' ||
      data.theme === 'neural' ||
      data.theme === 'cosmic' ||
      data.theme === 'quantum') &&
    (data.allowExternalAI === undefined || typeof data.allowExternalAI === 'boolean')
  );
}

function repairDuplicateMessageIds(data: LocalData): LocalData {
  const seen = new Set<string>();
  let changed = false;
  const messages = data.messages.map((message) => {
    if (!seen.has(message.id)) {
      seen.add(message.id);
      return message;
    }

    changed = true;
    let id = createLocalId();
    while (seen.has(id)) id = createLocalId();
    seen.add(id);
    return { ...message, id };
  });

  return changed ? { ...data, messages } : data;
}

export function readLocalData(): LocalData {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return emptyLocalData();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Somnia could not read its saved data. You can clear it in Settings.');
  }

  if (!isLocalData(parsed)) {
    throw new Error('Somnia found saved data in an unsupported format.');
  }
  return repairDuplicateMessageIds({
    ...parsed,
    allowExternalAI: parsed.allowExternalAI ?? false,
  });
}

export function writeLocalData(data: LocalData): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    throw new Error('Somnia could not save data in this browser. Check available storage space.');
  }
}

export function subscribeToLocalData(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

export function saveLocalData(data: LocalData): void {
  writeLocalData(data);
}

export function createLocalId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function exportLocalData(data: LocalData): string {
  return JSON.stringify(data, null, 2);
}

export function clearLocalData(): void {
  window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}
