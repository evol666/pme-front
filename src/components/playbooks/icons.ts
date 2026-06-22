import {
  Compass,
  Edit3,
  FileText,
  Layers,
  type LucideIcon,
  RefreshCw,
  Rocket,
  ShieldCheck,
  Target,
  UserCheck,
  UserPlus,
} from 'lucide-react';

const MAP: Record<string, LucideIcon> = {
  'user-plus': UserPlus,
  'shield-check': ShieldCheck,
  rocket: Rocket,
  'file-text': FileText,
  'refresh-cw': RefreshCw,
  'user-check': UserCheck,
  compass: Compass,
  layers: Layers,
  'edit-3': Edit3,
  target: Target,
};

export function iconForPlaybook(name?: string | null): LucideIcon {
  if (!name) return Target;
  return MAP[name] || Target;
}
