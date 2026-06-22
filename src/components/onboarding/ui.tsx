import {
  Activity,
  Building2,
  FileText,
  FolderUp,
  ListChecks,
  PartyPopper,
  Sparkles,
  Target,
  Wand2,
  type LucideIcon,
} from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  Sparkles,
  FolderUp,
  Activity,
  Wand2,
  PartyPopper,
  ListChecks,
  FileText,
  Target,
  Building2,
};

export function iconByName(name: string): LucideIcon {
  return ICONS[name] ?? Sparkles;
}

export interface AccentClasses {
  bg: string;
  text: string;
  border: string;
  ring: string;
}

const ACCENTS: Record<string, AccentClasses> = {
  brand: {
    bg: 'bg-primary/10',
    text: 'text-primary',
    border: 'border-primary/20',
    ring: 'ring-primary/30',
  },
  emerald: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-600',
    border: 'border-emerald-200',
    ring: 'ring-emerald-400/30',
  },
  amber: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-600',
    border: 'border-amber-200',
    ring: 'ring-amber-400/30',
  },
  cyber: {
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-600',
    border: 'border-cyan-200',
    ring: 'ring-cyan-400/30',
  },
};

export function accentClasses(accent: string): AccentClasses {
  return ACCENTS[accent] ?? ACCENTS.brand;
}
