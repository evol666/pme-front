import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
	Bell,
	Check,
	ChevronDown,
	Clock,
	LogOut,
	Menu,
	Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { logout } from "@/api/auth";
import { useUnreadNotificationCount } from "@/api/notifications";
import { usePersonas } from "@/api/personas";
import { useAppSelector } from "@/app/hooks";
import { EntrepriseSearchBar } from "@/components/recherche/EntrepriseSearchBar";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { cn } from "@/lib/utils";
import { usePersonaStore } from "@/stores/personaStore";

export function AppHeader({
	onMenuClick,
}: {
	readonly onMenuClick?: () => void;
}) {
	const { username } = useAppSelector((s) => s.auth);
	const navigate = useNavigate();
	const [dropdownOpen, setDropdownOpen] = useState(false);
	const currentTime = format(new Date(), "EEEE d MMMM yyyy - HH:mm", {
		locale: fr,
	});

	const handleLogout = () => {
		logout();
	};

	useEffect(() => {
		if (!dropdownOpen) return;
		function handleKeyDown(e: KeyboardEvent) {
			if (e.key === "Escape") setDropdownOpen(false);
		}
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [dropdownOpen]);

	return (
		<header className="h-16 bg-background border-b border-border flex items-center justify-between px-4 lg:px-6 z-40 sticky top-0 transition-colors shadow-sm">
			<div className="flex items-center gap-2 lg:gap-4">
				{/* Mobile menu trigger */}
				<button
					onClick={onMenuClick}
					className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-all lg:hidden"
					title="Ouvrir le menu"
					aria-label="Ouvrir le menu de navigation"
				>
					<Menu className="w-5 h-5" />
				</button>
				<span className="font-bold text-lg hidden lg:inline-block whitespace-nowrap">
					Module PME
				</span>
				<div className="hidden sm:block">
					<EntrepriseSearchBar />
				</div>
			</div>

			<div className="flex items-center gap-2 lg:gap-4">
				<PersonaSwitcher />

				<NotificationBell onClick={() => navigate("/notifications")} />

				<div className="flex items-center gap-2">
					<ThemeToggle />
				</div>

				<div className="hidden lg:flex items-center gap-2 text-muted-foreground text-xs font-medium border-l border-border pl-4 h-8">
					<Clock className="w-3.5 h-3.5" />
					<span className="capitalize">{currentTime}</span>
				</div>

				<div className="relative flex items-center gap-3 pl-2 border-l border-border">
					<button type="button"
						onClick={() => setDropdownOpen(!dropdownOpen)}
						className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
					>
						<div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
							{username?.[0]?.toUpperCase() ?? "U"}
						</div>
						<span className="text-sm font-medium hidden sm:inline-block">
							{username}
						</span>
						<ChevronDown className="w-4 h-4 text-muted-foreground" />
					</button>

					{dropdownOpen && (
						<>
							<div
								aria-hidden="true"
								className="fixed inset-0 z-40"
								onClick={() => setDropdownOpen(false)}
							/>
							<div className="absolute right-0 top-full mt-2 w-56 bg-card border border-border rounded-lg shadow-lg py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
								<div className="px-4 py-2 border-b border-border">
									<p className="text-xs text-muted-foreground">
										Connecté en tant que
									</p>
									<p className="text-sm font-bold text-foreground truncate">
										{username}
									</p>
								</div>
								<button
									onClick={handleLogout}
									className="w-full flex items-center px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors font-bold cursor-pointer text-left border-none"
								>
									<LogOut className="w-4 h-4 mr-2" />
									Déconnexion
								</button>
							</div>
						</>
					)}
				</div>
			</div>
		</header>
	);
}

// Cloche de notifications avec badge du nombre de non lues (refresh 60s géré
// côté hook useUnreadNotificationCount). Clic → page /notifications.
function NotificationBell({ onClick }: { readonly onClick: () => void }) {
	const { data } = useUnreadNotificationCount();
	const count = data?.unreadCount ?? 0;
	return (
		<button type="button"
			onClick={onClick}
			className="relative p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
			title="Notifications"
			aria-label={
				count > 0 ? `Notifications (${count} non lues)` : "Notifications"
			}
		>
			<Bell className="w-5 h-5" />
			{count > 0 && (
				<span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center tabular-nums">
					{count > 99 ? "99+" : count}
				</span>
			)}
		</button>
	);
}

// Sélecteur de persona : bascule le contexte d'affichage côté client. La liste
// vient de /api/user-personas ; le choix actif est persisté via le store Zustand.
function PersonaSwitcher() {
	const [open, setOpen] = useState(false);
	const { data: personas, isLoading } = usePersonas();
	const activePersonaId = usePersonaStore((s) => s.activePersonaId);
	const setActivePersona = usePersonaStore((s) => s.setActivePersona);

	useEffect(() => {
		if (!open) return;
		function handleKeyDown(e: KeyboardEvent) {
			if (e.key === "Escape") setOpen(false);
		}
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [open]);

	// Pas de switcher si la liste est vide ou en cours de chargement initial.
	if (isLoading || !personas || personas.length === 0) return null;

	const active = personas.find((p) => p.id === activePersonaId);
	const label = active?.role ?? "Tous les contextes";

	return (
		<div className="relative">
			<button type="button"
				onClick={() => setOpen(!open)}
				className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-accent transition-colors text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
				title="Changer de persona"
			>
				<Users className="w-4 h-4 text-primary" />
				<span className="hidden sm:inline-block max-w-[140px] truncate">
					{label}
				</span>
				<ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
			</button>

			{open && (
				<>
					<div
						aria-hidden="true"
						className="fixed inset-0 z-40"
						onClick={() => setOpen(false)}
					/>
					<div className="absolute right-0 top-full mt-2 w-60 bg-card border border-border rounded-lg shadow-lg py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
						<div className="px-3 py-2 border-b border-border">
							<p className="text-xs text-muted-foreground">
								Contexte d'affichage
							</p>
						</div>
						<button type="button"
							onClick={() => {
								setActivePersona(null);
								setOpen(false);
							}}
							className={cn(
								"w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent transition-colors",
								activePersonaId === null
									? "text-foreground font-medium"
									: "text-muted-foreground",
							)}
						>
							<span className="flex-1 truncate">Tous les contextes</span>
							{activePersonaId === null && (
								<Check className="w-4 h-4 text-primary" />
							)}
						</button>
						{personas.map((persona) => (
							<button type="button"
								key={persona.id}
								onClick={() => {
									setActivePersona(persona.id);
									setOpen(false);
								}}
								className={cn(
									"w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent transition-colors",
									activePersonaId === persona.id
										? "text-foreground font-medium"
										: "text-muted-foreground",
								)}
							>
								<span className="flex-1 truncate">
									{persona.role ?? `Persona #${persona.id}`}
								</span>
								{activePersonaId === persona.id && (
									<Check className="w-4 h-4 text-primary" />
								)}
							</button>
						))}
					</div>
				</>
			)}
		</div>
	);
}
