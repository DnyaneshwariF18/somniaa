import type { LocalData, LocalMemory } from '@/localData';

export interface ApiStatus {
  backend: 'ok';
  storage: 'sqlite';
  llm: {
    configured: boolean;
    enabled: boolean;
    model: string | null;
    mode: 'ai' | 'demo';
  };
  scheduledJobs: boolean;
}

export interface ChatProposalConflict {
  proposal: string;
  existingMemoryId?: string;
  existingMemory: string;
  reason: string;
}

export interface ChatResponse {
  mode: 'ai' | 'demo';
  text?: string;
  proposals?: string[];
  conflicts?: ChatProposalConflict[];
}

interface ApiError {
  error?: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    });
  } catch {
    throw new Error('Somnia backend is unavailable. Start it with `npm run dev:all`.');
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      body && typeof body === 'object' && 'error' in body &&
      typeof (body as ApiError).error === 'string'
        ? (body as ApiError).error
        : `Somnia backend request failed (${response.status}).`;
    throw new Error(message);
  }
  return body as T;
}

export async function getApiStatus(): Promise<ApiStatus> {
  return request<ApiStatus>('/api/health');
}

export async function getServerData(): Promise<{ data: LocalData | null }> {
  return request<{ data: LocalData | null }>('/api/data');
}

export async function saveServerData(data: LocalData): Promise<void> {
  await request<{ ok: true }>('/api/data', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function clearServerData(): Promise<void> {
  await request<{ ok: true }>('/api/data', { method: 'DELETE' });
}

export async function sendChatMessage(
  message: string,
  history: Array<{ role: 'user' | 'somnia'; text: string }>,
  allowExternalAI: boolean,
): Promise<ChatResponse> {
  return request<ChatResponse>('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ message, history, allowExternalAI }),
  });
}

export async function runServerSleepCycle(): Promise<LocalData> {
  const result = await request<{ data: LocalData }>('/api/sleep-cycle', {
    method: 'POST',
    headers: { 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify({}),
  });
  return result.data;
}

export interface MemoryContradictionItem {
  memoryA: LocalMemory;
  memoryB: LocalMemory;
  reason: string;
}

export async function getMemoryContradictions(): Promise<{ contradictions: MemoryContradictionItem[] }> {
  return request<{ contradictions: MemoryContradictionItem[] }>('/api/memories/contradictions');
}

// ─── Memory CRUD ─────────────────────────────────────────────────────────────

export async function createMemory(text: string): Promise<LocalMemory> {
  return request<LocalMemory>('/api/memories', {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

export async function listMemories(): Promise<LocalMemory[]> {
  const result = await request<{ memories: LocalMemory[] }>('/api/memories');
  return result.memories;
}

export async function getMemory(id: string): Promise<LocalMemory> {
  return request<LocalMemory>(`/api/memories/${encodeURIComponent(id)}`);
}

export async function approveMemory(id: string): Promise<LocalMemory> {
  return request<LocalMemory>(`/api/memories/${encodeURIComponent(id)}/approve`, {
    method: 'PATCH',
  });
}

export async function editMemory(
  id: string,
  patch: { text?: string; status?: 'approved' | 'archived' },
): Promise<LocalMemory> {
  return request<LocalMemory>(`/api/memories/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function deleteMemory(id: string): Promise<void> {
  await request<{ ok: true }>(`/api/memories/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
