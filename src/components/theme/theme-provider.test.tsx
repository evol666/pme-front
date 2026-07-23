import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider, useTheme } from "./theme-provider";

describe("ThemeProvider / useTheme", () => {
	beforeEach(() => {
		localStorage.clear();
		document.documentElement.className = "";
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("expose un contexte par défaut hors ThemeProvider (pas de throw)", () => {
		const { result } = renderHook(() => useTheme());
		expect(result.current.theme).toBe("system");
	});

	it("utilise le thème par défaut si rien n'est stocké en localStorage", () => {
		const { result } = renderHook(() => useTheme(), {
			wrapper: ({ children }) => (
				<ThemeProvider defaultTheme="dark">{children}</ThemeProvider>
			),
		});
		expect(result.current.theme).toBe("dark");
		expect(document.documentElement.classList.contains("dark")).toBe(true);
	});

	it("lit le thème persisté depuis le localStorage", () => {
		localStorage.setItem("vite-ui-theme", "light");
		const { result } = renderHook(() => useTheme(), {
			wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
		});
		expect(result.current.theme).toBe("light");
	});

	it("résout le thème système en fonction de prefers-color-scheme", () => {
		vi.stubGlobal("matchMedia", (query: string) => ({
			matches: query.includes("dark"),
			media: query,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
		}));

		renderHook(() => useTheme(), {
			wrapper: ({ children }) => (
				<ThemeProvider defaultTheme="system">{children}</ThemeProvider>
			),
		});
		expect(document.documentElement.classList.contains("dark")).toBe(true);
		expect(document.documentElement.classList.contains("theme-app")).toBe(true);
	});

	it("met à jour le thème et le persiste en localStorage via setTheme", () => {
		const { result } = renderHook(() => useTheme(), {
			wrapper: ({ children }) => (
				<ThemeProvider storageKey="custom-theme-key" defaultTheme="light">
					{children}
				</ThemeProvider>
			),
		});

		act(() => {
			result.current.setTheme("dark");
		});

		expect(result.current.theme).toBe("dark");
		expect(localStorage.getItem("custom-theme-key")).toBe("dark");
		expect(document.documentElement.classList.contains("dark")).toBe(true);
		expect(document.documentElement.classList.contains("light")).toBe(false);
	});
});
