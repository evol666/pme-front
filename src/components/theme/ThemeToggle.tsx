import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme/theme-provider";

export function ThemeToggle() {
	const { setTheme, theme } = useTheme();

	const cycleTheme = () => {
		switch (theme) {
			case "light":
				setTheme("dark");
				break;
			case "dark":
				setTheme("light");
				break;
			default:
				setTheme("light");
		}
	};

	return (
		<button
			onClick={cycleTheme}
			className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-all focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
			aria-label="Changer de thème"
		>
			{theme === "light" ? (
				<Sun className="h-5 w-5" />
			) : (
				<Moon className="h-5 w-5" />
			)}
		</button>
	);
}
