import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useOnboardingWelcome, useSaveWelcome } from '@/api/onboarding';

export default function WelcomeStep() {
  const { data: welcome } = useOnboardingWelcome();
  const saveWelcome = useSaveWelcome();

  const [companyName, setCompanyName] = useState('');
  const [secteur, setSecteur] = useState('');
  const [headcount, setHeadcount] = useState('');
  const [activity, setActivity] = useState('');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (welcome && !hydrated) {
      setCompanyName(welcome.company_name || '');
      setSecteur(welcome.secteur || '');
      setHeadcount(welcome.headcount || '');
      setActivity(welcome.activity || '');
      setHydrated(true);
    }
  }, [welcome, hydrated]);

  const persist = () => {
    saveWelcome.mutate({
      company_name: companyName,
      secteur,
      headcount,
      activity,
    });
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
