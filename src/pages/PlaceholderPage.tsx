import { useLocation } from "react-router-dom";
import { Construction } from "lucide-react";

// Page temporaire pour les routes canoniques dont la page réelle n'est pas
// encore migrée (Phases 3-6). Garde la navigation fonctionnelle et lançable.
// Remplacée par la vraie page lazy quand celle-ci est créée.

export default function PlaceholderPage() {
  const { pathname } = useLocation();
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-6">
        <Construction className="w-8 h-8" />
      </div>
      <h1 className="text-2xl font-bold text-foreground">En construction</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Route{" "}
        <code className="px-1.5 py-0.5 rounded bg-accent font-mono text-foreground">
          {pathname}
        </code>
        {"— page à migrer (Phase 3+)."}
      </p>
    </div>
  );
}