import {
  BarChart3,
  Briefcase,
  Layout,
  LayoutDashboard,
  Settings,
  Shield,
  Sparkles,
  Target,
} from "lucide-react";
import type React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAppSelector } from "@/app/hooks";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
};

// Navigation principale — architecture company-centric.
// Recommandations, Documents, Journal, Playbooks sont des onglets dans la fiche entreprise.
const mainNav: NavItem[] = [
  { href: "/accueil",        label: "Accueil",         icon: LayoutDashboard },
  { href: "/entreprises",    label: "Entreprises",     icon: Briefcase },
  { href: "/copilote",       label: "Copilote IA",     icon: Sparkles },
  { href: "/mode-directeur", label: "Mode Directeur",  icon: Target },
  { href: "/analyses",       label: "Analyses",        icon: BarChart3 },
];

// Routes visibles uniquement pour ROLE_ADMIN.
const adminNav: NavItem[] = [
  { href: "/supervision",  label: "Supervision",  icon: Shield },
  { href: "/admin-global", label: "Admin global", icon: Settings },
];

function NavSection({
  items,
  pathname,
  title,
}: {
  items: NavItem[];
  pathname: string;
  title?: string;
}) {
  return (
    <>
      {title && (
        <p className="px-4 pt-4 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
          {title}
        </p>
      )}
      {items.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            to={item.href}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group text-sm font-medium",
              isActive
                ? "bg-primary/10 text-primary font-bold"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Icon
              className={cn(
                "w-5 h-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-110",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground group-hover:text-foreground",
              )}
            />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </>
  );
}

export function Sidebar() {
  const location = useLocation();
  const pathname = location.pathname;
  const roles = useAppSelector((s) => s.auth.roles);
  const isAdmin = roles.includes("ROLE_ADMIN");

  return (
    <aside className="h-full w-full bg-card flex flex-col border-r border-border transition-all duration-300">
      {/* Logo */}
      <div className="h-20 p-6 flex items-center justify-between border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 flex-shrink-0 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
            <Layout className="w-6 h-6 text-primary-foreground" />
          </div>
          <div className="overflow-hidden whitespace-nowrap">
            <h1 className="text-lg font-bold text-foreground leading-tight tracking-tight uppercase">
              Athanor PME
            </h1>
            <p className="text-[10px] text-primary uppercase font-bold tracking-widest opacity-80 mt-1">
              Plateforme IA
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto custom-scrollbar">
        <NavSection items={mainNav} pathname={pathname} />
        {isAdmin && (
          <NavSection
            items={adminNav}
            pathname={pathname}
            title="Administration"
          />
        )}
      </nav>

      {/* Footer info */}
      <div className="p-6">
        <div className="p-4 bg-accent/50 rounded-2xl border border-border/10">
          <p className="text-xs font-bold text-primary tracking-widest uppercase opacity-70">
            Athanor
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            PME Management
          </p>
        </div>
      </div>
    </aside>
  );
}