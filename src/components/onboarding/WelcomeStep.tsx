import { useEffect, useState } from 'react';
import { Sparkles, Search, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useOnboardingWelcome, useSaveWelcome } from '@/api/onboarding';
import { useEntreprise } from '@/api/entreprises';

// Mappe un effectif estimé (nombre de salariés) vers une tranche du wizard.
// Les valeurs doivent rester alignées avec HEADCOUNT_LABELS (OnboardingService.java).
function effectifToHeadcount(estime: number | null | undefined): string {
  if (estime == null || estime <= 0) return '';
  if (estime === 1) return '1';
  if (estime <= 9) return '2-9';
  if (estime <= 49) return '10-49';
  if (estime <= 249) return '50-249';
  return '250+';
}

export default function WelcomeStep() {
  const { data: welcome } = useOnboardingWelcome();
  const saveWelcome = useSaveWelcome();

  const [companyName, setCompanyName] = useState('');
  const [secteur, setSecteur] = useState('');
  const [headcount, setHeadcount] = useState('');
  const [activity, setActivity] = useState('');
  const [hydrated, setHydrated] = useState(false);

  // SIREN
  const [siren, setSiren] = useState('');
  const [activeSiren, setActiveSiren] = useState<string | null>(null);
  const [filled, setFilled] = useState(false);
  const sirenValid = /^\d{9}$/.test(siren);

  const { data: entreprise, isFetching, isError } = useEntreprise(activeSiren);

  useEffect(() => {
    if (!welcome || hydrated) return;
    setCompanyName(welcome.company_name || ''); // eslint-disable-line react-hooks/set-state-in-effect
    setSecteur(welcome.secteur || '');  
    setHeadcount(welcome.headcount || '');  
    setActivity(welcome.activity || '');  
    setSiren(welcome.siren || '');  
    setHydrated(true);  
  }, [welcome, hydrated]);

  const persistAll = (values: {
    company_name: string;
    secteur: string;
    headcount: string;
    activity: string;
    siren: string;
  }) => {
    saveWelcome.mutate(values);
  };

  const persist = () => {
    persistAll({ company_name: companyName, secteur, headcount, activity, siren });
  };

  // Pré-remplissage automatique dès que la fiche enrichie arrive.
  useEffect(() => {
    if (!entreprise || filled) return;
    const id = entreprise.identite;
    if (!id) return;

    const nextName = id.raison_sociale || companyName;
    const nextSecteur = id.libelle_naf || id.section_naf || secteur;
    const nextHeadcount = effectifToHeadcount(id.effectif_estime) || headcount;
    const villeSuffix = id.ville ? ` — ${id.ville}` : '';
    const nextActivity = id.libelle_naf ? `${id.libelle_naf}${villeSuffix}` : activity;

    setCompanyName(nextName); // eslint-disable-line react-hooks/set-state-in-effect
    setSecteur(nextSecteur);  
    setHeadcount(nextHeadcount);  
    setActivity(nextActivity);  
    setFilled(true);  

    persistAll({
      company_name: nextName,
      secteur: nextSecteur,
      headcount: nextHeadcount,
      activity: nextActivity,
      siren: activeSiren || siren,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entreprise]);

  const handlePrefill = () => {
    if (!sirenValid) return;
    setFilled(false);
    setActiveSiren(siren);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Sparkles className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Bienvenue 👋</h2>
          <p className="text-sm text-muted-foreground">
            {welcome?.prefilled
              ? 'Voici ce que nous savons déjà. Corrigez si besoin.'
              : 'Quelques informations pour personnaliser votre espace.'}
          </p>
        </div>
      </div>

      {/* Pré-remplissage par SIREN */}
      <div className="rounded-xl border border-border bg-muted/30 p-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-foreground">
            SIREN de votre entreprise
          </span>
          <span className="mb-2 block text-xs text-muted-foreground">
            Saisissez votre SIREN (9 chiffres) pour pré-remplir automatiquement le formulaire.
          </span>
          <div className="flex gap-2">
            <input
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              value={siren}
              onChange={(e) => {
                setSiren(e.target.value.replace(/\D/g, '').slice(0, 9));
                setFilled(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handlePrefill();
              }}
              inputMode="numeric"
              placeholder="Ex. 552081317"
            />
            <button
              type="button"
              onClick={handlePrefill}
              disabled={!sirenValid || isFetching}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Pré-remplir
            </button>
          </div>
        </label>

        {isError && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5" />
            SIREN introuvable. Vérifiez le numéro ou saisissez les informations manuellement.
          </p>
        )}
        {filled && !isError && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Formulaire pré-rempli. Vérifiez et corrigez si besoin.
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-foreground">
            Nom de l'entreprise
          </span>
          <input
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            onBlur={persist}
            placeholder="Ex. Acme Conseil"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-foreground">Secteur</span>
          <input
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            value={secteur}
            onChange={(e) => setSecteur(e.target.value)}
            onBlur={persist}
            placeholder="Ex. Services aux entreprises"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-foreground">
            Nombre de salariés
          </span>
          <select
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            value={headcount}
            onChange={(e) => setHeadcount(e.target.value)}
            onBlur={persist}
          >
            <option value="">Sélectionner…</option>
            {(welcome?.headcount_options || []).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block sm:col-span-2">
          <span className="mb-1 block text-sm font-medium text-foreground">
            Activité principale
          </span>
          <textarea
            className="w-full min-h-[88px] rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            value={activity}
            onChange={(e) => setActivity(e.target.value)}
            onBlur={persist}
            placeholder="En une phrase, que fait votre entreprise ?"
          />
        </label>
      </div>
    </div>
  );
}
