import {
  Box,
  Building2,
  Edit3,
  Gem,
  Megaphone,
  Sparkles,
  Tag,
  Target,
  type LucideIcon,
  UserPlus,
  Users,
} from 'lucide-react';

const MAP: Record<string, LucideIcon> = {
  'user-plus': UserPlus,
  users: Users,
  gem: Gem,
  'building-2': Building2,
  sparkles: Sparkles,
  megaphone: Megaphone,
  box: Box,
  tag: Tag,
  'edit-3': Edit3,
  target: Target,
};

export function iconForScenario(name?: string | null): LucideIcon {
  if (!name) return Target;
  return MAP[name] || Target;
}
