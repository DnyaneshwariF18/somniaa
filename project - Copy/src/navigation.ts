import {
  LayoutDashboard,
  MessageSquare,
  Brain,
  Bell,
  Moon,
  Sunrise,
  BookOpen,
  Settings,
  type LucideIcon,
} from 'lucide-react';

export type ScreenId =
  | 'dashboard'
  | 'chat'
  | 'memories'
  | 'reminders'
  | 'sleep-cycle'
  | 'morning-report'
  | 'decision-journal'
  | 'settings';

export interface NavDestination {
  id: ScreenId;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  description: string;
}

export const NAV_DESTINATIONS: NavDestination[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    shortLabel: 'Home',
    icon: LayoutDashboard,
    description: 'Your daily overview at a glance.',
  },
  {
    id: 'chat',
    label: 'Chat',
    shortLabel: 'Chat',
    icon: MessageSquare,
    description: 'Converse with your personal AI assistant.',
  },
  {
    id: 'memories',
    label: 'Memories',
    shortLabel: 'Memories',
    icon: Brain,
    description: 'Review and manage what Somnia remembers about you.',
  },
  {
    id: 'reminders',
    label: 'Reminders',
    shortLabel: 'Reminders',
    icon: Bell,
    description: 'Create and manage smart reminders.',
  },
  {
    id: 'sleep-cycle',
    label: 'Sleep Cycle',
    shortLabel: 'Sleep',
    icon: Moon,
    description: 'A background review of your memories and proposals.',
  },
  {
    id: 'morning-report',
    label: 'Morning Report',
    shortLabel: 'Morning',
    icon: Sunrise,
    description: 'Approve or reject proposals from the sleep cycle.',
  },
  {
    id: 'decision-journal',
    label: 'Decision Journal',
    shortLabel: 'Journal',
    icon: BookOpen,
    description: 'A log of decisions and their rationale.',
  },
  {
    id: 'settings',
    label: 'Settings & Privacy',
    shortLabel: 'Settings',
    icon: Settings,
    description: 'Privacy controls and data preferences.',
  },
];

export const NAV_MAP: Record<ScreenId, NavDestination> = NAV_DESTINATIONS.reduce(
  (acc, d) => {
    acc[d.id] = d;
    return acc;
  },
  {} as Record<ScreenId, NavDestination>,
);
