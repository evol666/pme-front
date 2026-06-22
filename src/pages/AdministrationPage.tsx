import { Link } from "react-router-dom";
import {
  Settings,
  Shield,
  ShieldAlert,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { useAppSelector } from "@/app/hooks";

// AdministrationPage — hub d'administration réservé à ROLE_ADMIN.
// Les sous-fonctions (supervision, analytics, admin global) restent en
// placeholder (Phases 4-6) ; cette page garantit le contrôle d'accès et
// fournit la navigation vers elles.

function AdminCard({
  to,
  title,
  description,
  icon: Icon,
}: {
  to: string;
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <Link
      to={to}
      className="group bg-card border border-border/50 rounded-2xl p-5 shadow-sm hover:border-primary/40 transition-colors"
    >
      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="mt-4 text-sm font-bold text-foreground">{title}</h3>
      <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
    </Link>
  );
}

export default function AdministrationPage() {
  const roles = useAppSelector((s) => s.auth.roles);
  const isAdmin = roles.includes("ROLE_ADMIN");

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mb-6">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Accès refusé</h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-md">
          Cette section est réservée aux administrateurs. Votre compte n'a pas
          le rôle{" "}
          <code className="px-1.5 py-0.5 rounded bg-accent font-mono text-foreground">
            ROLE_ADMIN
          </code>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-primary">
          Administration
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground mt-1">
          Administration
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Supervision, analytics et configuration globale de la plateforme.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <AdminCard
          to="/supervision"
          title="Supervision"
          description="État des services et jobs"
          icon={Shield}
        />
        <AdminCard
          to="/analytics"
          title="Analytics"
          description="Métriques d'usage et performance"
          icon={TrendingUp}
        />
        <AdminCard
          to="/admin-global"
          title="Admin global"
          description="Configuration et paramètres globaux"
          icon={Settings}
        />
      </div>

      <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">
          Rôles du compte
        </h2>
        <div className="flex flex-wrap gap-2">
          {roles.map((role) => (
            <span
              key={role}
              className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-primary/10 text-primary"
            >
              {role}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}