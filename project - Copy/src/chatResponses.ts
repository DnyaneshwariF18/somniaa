// Simulated, clearly-fake response logic for the Somnia chat demo.
// No external AI, no network calls — just keyword-based canned replies.

export interface DemoReply {
  text: string;
}

interface KeywordGroup {
  keywords: string[];
  replies: string[];
}

const GROUPS: KeywordGroup[] = [
  {
    keywords: ['plan', 'day', 'schedule', 'today'],
    replies: [
      "Here's a gentle draft for your day:\n\n• Morning — a slow start, water, and one clear intention.\n• Midday — your deepest focus block, protected from pings.\n• Afternoon — lighter creative work and a short walk.\n• Evening — wind down, reflect, and let the day settle.\n\nWant me to turn any of these into a reminder?",
      "Let's shape your day around energy, not just time. Try this:\n\n1. Anchor hour — your most important task, first.\n2. Recovery pocket — 20 minutes offline after lunch.\n3. Closing ritual — a short note on what went well.\n\nShall I suggest reminders for each?",
    ],
  },
  {
    keywords: ['focus', 'study', 'studying', 'concentrate', 'work'],
    replies: [
      "For studying well, rhythm matters more than hours. Try 50 minutes of focused work, then a real 10-minute break — away from your screen.\n\nBefore you start, close the tabs you don't need and silence non-urgent notifications. If your mind drifts, jot the distraction on paper and return.",
      "Focus isn't about forcing attention — it's about removing friction. Pick one task, make it small enough to start in under two minutes, and protect the next 45 minutes.\n\nWhen you finish, take a genuine break. Your brain consolidates in the pauses.",
    ],
  },
  {
    keywords: ['routine', 'habit', 'morning', 'evening'],
    replies: [
      "A sustainable routine starts tiny. Pick one anchor — a glass of water, two minutes of stretching, or writing one sentence — and do it at the same time each day for a week.\n\nOnce it feels automatic, layer the next habit on top. Consistency beats intensity every time.",
      "Routines work best when they match your natural energy. If mornings feel heavy, anchor your routine to the evening instead. The goal isn't an idealised schedule — it's a rhythm you can actually keep.",
    ],
  },
  {
    keywords: ['stress', 'overwhelm', 'anxious', 'anxiety', 'tired', 'burnout'],
    replies: [
      "When everything feels loud, the kindest thing you can do is narrow your view. Choose one small, finishable task — even just replying to one message — and let that be enough for now.\n\nYou don't have to solve the whole day at once.",
      "Stress often comes from carrying too many open loops. Try a two-minute brain-dump: write down everything on your mind, no structure needed. Then pick just one thing to act on. The rest can wait.",
    ],
  },
  {
    keywords: ['organize', 'organise', 'thoughts', 'clear', 'brain dump'],
    replies: [
      "Let's untangle things together. Try dumping everything that's on your mind — tasks, worries, half-ideas — into one list, no order required.\n\nOnce it's out of your head, we can sort it into what's urgent, what's important, and what can simply be let go.",
      "To organise your thoughts, give them somewhere to land. A single page, three columns: 'now', 'next', 'someday'. Don't overthink the sorting — the clarity comes from the act of separating.",
    ],
  },
  {
    keywords: ['sleep', 'rest', 'wind down', 'night'],
    replies: [
      "Good rest starts before bedtime. Try dimming your lights an hour before, and giving your mind a 'parking lot' — a note of anything unresolved so it doesn't loop while you try to sleep.\n\nYour sleep cycle review can pick this up tomorrow and suggest gentle adjustments.",
    ],
  },
  {
    keywords: ['hello', 'hi', 'hey', 'morning', 'evening'],
    replies: [
      "Hello — I'm Somnia, your personal assistant. This is a simulated demo response, but I'm here to help you think clearly.\n\nWhat's on your mind today?",
      "Hey there. Take a breath. What would feel most useful right now — planning, focusing, or simply untangling your thoughts?",
    ],
  },
];

const FALLBACK_REPLIES: string[] = [
  "That's a good thing to sit with. Here's a simulated take: try breaking it into one part you can act on today and one part that can wait. Momentum often follows the smallest first step.",
  "I hear you. In this demo I can't reason like a real model, but here's a simple frame: what would 'done' look like for this? Start there and work backwards.",
  "Let's keep it simple. If this were the only thing on your plate, what would you do first? That's usually the right place to begin.",
  "Consider this: most overwhelm comes from unclear next steps, not from too much to do. What's one concrete action you could take in the next ten minutes?",
];

function pickRandom<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length]!;
}

function matchesAny(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((k) => lower.includes(k));
}

/**
 * Returns a varied, keyword-aware simulated reply.
 * Keeps a rotating index so consecutive messages don't repeat verbatim.
 */
export function getDemoReply(userText: string, counter: number): DemoReply {
  const trimmed = userText.trim();
  const seed = counter + Math.floor(Math.random() * 7);

  for (const group of GROUPS) {
    if (matchesAny(trimmed, group.keywords)) {
      return { text: pickRandom(group.replies, seed) };
    }
  }
  return { text: pickRandom(FALLBACK_REPLIES, seed) };
}

export const SUGGESTIONS: string[] = [
  'Help me plan my day.',
  'Help me focus on studying.',
  'I want to organize my thoughts.',
  'Help me build a better routine.',
];
