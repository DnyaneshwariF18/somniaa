export type ThemeId = 'somnia' | 'neural' | 'cosmic' | 'quantum';

export interface ThemeConfig {
  id: ThemeId;
  label: string;
  swatch: string[];
}

export const THEMES: ThemeConfig[] = [
  {
    id: 'somnia',
    label: 'Somnia',
    swatch: ['#4f46e5', '#8b7ff0'],
  },
  {
    id: 'neural',
    label: 'Neural Flow',
    swatch: ['#1d4ed8', '#06b6d4'],
  },
  {
    id: 'cosmic',
    label: 'Cosmic Core',
    swatch: ['#7c3aed', '#a855f7'],
  },
  {
    id: 'quantum',
    label: 'Quantum Light',
    swatch: ['#2563eb', '#60a5fa'],
  },
];
