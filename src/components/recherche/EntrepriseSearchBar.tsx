import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Loader2, Search, X } from "lucide-react";
import { useEntrepriseSearch } from "@/api/entreprises";
import { cn } from "@/lib/utils";

/**
 * Barre de recherche globale SIREN / nom d'entreprise.
 * - Debounce 300ms
 * - Dropdown de résultats (max 8)
 * - Saisie d'un SIREN exact (9 chiffres) → navigation directe
 * - Fermeture sur Escape ou clic extérieur
 */
export function EntrepriseSearchBar() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);

  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isFetching } = useEntrepriseSearch(debouncedQuery, 0, 8);
  const results = data?.results ?? [];

  // Ouvrir le dropdown quand des résultats arrivent
  useEffect(() => {
    if (debouncedQuery.length >= 2) setOpen(true); // eslint-disable-line react-hooks/set-state-in-effect
    else setOpen(false);  
    setActiveIdx(-1);  
  }, [debouncedQuery, results.length]);

  // Fermeture sur clic extérieur
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function goTo(siren: string) {
    navigate(`/entreprises/${siren}`);
    setQuery("");
    setDebouncedQuery("");
    setOpen(false);
    inputRef.current?.blur();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIdx >= 0 && results[activeIdx]) {
        goTo(results[activeIdx].siren);
      } else if (/^\d{9}$/.test(query.trim())) {
        // SIREN direct
        goTo(query.trim());
      } else if (results.length > 0) {
        goTo(results[0].siren);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  function clear() {
    setQuery("");
    setDebouncedQuery("");
    setOpen(false);
    inputRef.current?.focus();
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-sm lg:max-w-md">
      {/* Input */}
      <div className="relative flex items-center">
        <Search className="absolute left-3 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (debouncedQuery.length >= 2) setOpen(true); }}
          placeholder="Rechercher un SIREN ou une entreprise…"
          autoComplete="off"
          spellCheck={false}
          className={cn(
            "w-full h-9 pl-9 pr-8 text-sm rounded-lg border border-border",
            "bg-muted/40 text-foreground placeholder:text-muted-foreground",
            "focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50",
            "transition-all",
          )}
        />
        {/* Indicateur chargement / clear */}
        <span className="absolute right-2.5 flex items-center">
          {isFetching && (
            <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin" />
          )}
          {!isFetching && query.length > 0 && (
            <button
              onClick={clear}
              className="text-muted-foreground hover:text-foreground transition-colors"
              tabIndex={-1}
              aria-label="Effacer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </span>
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {results.length === 0 && !isFetching && (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              Aucune entreprise trouvée pour « {debouncedQuery} »
            </p>
          )}

          {results.map((r, i) => (
            <button
              key={r.siren}
              onClick={() => goTo(r.siren)}
              onMouseEnter={() => setActiveIdx(i)}
              className={cn(
                "w-full flex items-start gap-3 px-4 py-2.5 text-left transition-colors border-none text-sm",
                i === activeIdx
                  ? "bg-primary/8 text-foreground"
                  : "text-foreground hover:bg-accent",
                i < results.length - 1 && "border-b border-border/50",
              )}
            >
              <span className={cn(
                "mt-0.5 flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold",
                r.etat === "A"
                  ? "bg-emerald-500/10 text-emerald-600"
                  : "bg-muted text-muted-foreground",
              )}>
                <Building2 className="w-3.5 h-3.5" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block font-semibold truncate leading-tight">
                  {r.nomAffichage}
                </span>
                <span className="block text-xs text-muted-foreground mt-0.5">
                  {r.siren}
                  {r.codeNaf && <> · {r.codeNaf}</>}
                  {r.categorie && <> · {r.categorie}</>}
                  {r.etat !== "A" && (
                    <span className="ml-1.5 text-amber-500 font-medium">cessée</span>
                  )}
                </span>
              </span>
            </button>
          ))}

          {data && data.total > results.length && (
            <div className="px-4 py-2 border-t border-border bg-muted/30">
              <p className="text-xs text-muted-foreground">
                {data.total.toLocaleString("fr-FR")} résultats — affinez votre recherche
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
