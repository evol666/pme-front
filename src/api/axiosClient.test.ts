import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { dispatchMock, logoutActionMock } = vi.hoisted(() => ({
	dispatchMock: vi.fn(),
	logoutActionMock: vi.fn(() => ({ type: "auth/logout" })),
}));

vi.mock("../store", () => ({
	store: { dispatch: dispatchMock },
}));
vi.mock("../features/auth/authSlice", () => ({
	logout: logoutActionMock,
}));

import type { AxiosError, InternalAxiosRequestConfig } from "axios";
import axiosClient from "./axiosClient";

type RequestFulfilled = (
	config: InternalAxiosRequestConfig,
) => InternalAxiosRequestConfig;
type ResponseRejected = (err: AxiosError) => Promise<never>;

function buildError(overrides: Partial<AxiosError> = {}): AxiosError {
	return {
		isAxiosError: true,
		name: "AxiosError",
		message: "Request failed",
		config: { url: "/api/company/analyze" } as any,
		response: {
			status: 401,
			statusText: "Unauthorized",
			headers: {},
			config: {} as any,
			data: {},
		},
		toJSON: () => ({}),
		...overrides,
	} as AxiosError;
}

describe("axiosClient", () => {
	const requestFulfilled: RequestFulfilled = (
		axiosClient.interceptors.request as any
	).handlers[0].fulfilled;
	const responseRejected: ResponseRejected = (
		axiosClient.interceptors.response as any
	).handlers[0].rejected;

	beforeEach(() => {
		dispatchMock.mockClear();
		logoutActionMock.mockClear();
		document.cookie = "XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT";
		sessionStorage.clear();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	describe("réécriture d'URL vers la gateway", () => {
		it("préfixe les URLs /api/* par /services/pme", () => {
			const config = requestFulfilled({
				url: "/api/company/analyze",
				headers: {},
			} as InternalAxiosRequestConfig);
			expect(config.url).toBe("/services/pme/api/company/analyze");
		});

		it("ne réécrit pas les endpoints d'auth (AUTH_PATHS)", () => {
			const config = requestFulfilled({
				url: "/api/account",
				headers: {},
			} as InternalAxiosRequestConfig);
			expect(config.url).toBe("/api/account");
		});

		it("laisse les URLs hors /api/ inchangées", () => {
			const config = requestFulfilled({
				url: "/oauth2/authorization/pme",
				headers: {},
			} as InternalAxiosRequestConfig);
			expect(config.url).toBe("/oauth2/authorization/pme");
		});
	});

	describe("en-tête CSRF", () => {
		it("ajoute X-XSRF-TOKEN sur les requêtes mutatives si le cookie est présent", () => {
			document.cookie = "XSRF-TOKEN=abc123";
			const config = requestFulfilled({
				url: "/api/entreprises",
				method: "post",
				headers: {},
			} as InternalAxiosRequestConfig);
			expect(config.headers?.["X-XSRF-TOKEN"]).toBe("abc123");
		});

		it("n'ajoute pas de header CSRF sur les requêtes GET", () => {
			document.cookie = "XSRF-TOKEN=abc123";
			const config = requestFulfilled({
				url: "/api/entreprises",
				method: "get",
				headers: {},
			} as InternalAxiosRequestConfig);
			expect(config.headers?.["X-XSRF-TOKEN"]).toBeUndefined();
		});

		it("n'ajoute pas de header CSRF si le cookie est absent", () => {
			const config = requestFulfilled({
				url: "/api/entreprises",
				method: "post",
				headers: {},
			} as InternalAxiosRequestConfig);
			expect(config.headers?.["X-XSRF-TOKEN"]).toBeUndefined();
		});
	});

	describe("gestion du 401", () => {
		it("déconnecte et redirige vers Keycloak sur un 401 fonctionnel", async () => {
			const location = { href: "", pathname: "/entreprises" };
			vi.stubGlobal("location", location);

			const error = buildError({
				config: { url: "/api/company/analyze" } as any,
			});
			await expect(responseRejected(error)).rejects.toBe(error);

			expect(dispatchMock).toHaveBeenCalledWith({ type: "auth/logout" });
			expect(location.href).toBe("/oauth2/authorization/pme");
		});

		it("ignore la sonde de session /api/account pour éviter la boucle", async () => {
			const location = { href: "", pathname: "/entreprises" };
			vi.stubGlobal("location", location);

			const error = buildError({ config: { url: "/api/account" } as any });
			await expect(responseRejected(error)).rejects.toBe(error);

			expect(dispatchMock).not.toHaveBeenCalled();
			expect(location.href).toBe("");
		});

		it("n'enchaîne pas si déjà sur /oauth2/...", async () => {
			const location = { href: "", pathname: "/oauth2/authorization/pme" };
			vi.stubGlobal("location", location);

			const error = buildError();
			await expect(responseRejected(error)).rejects.toBe(error);

			expect(dispatchMock).not.toHaveBeenCalled();
		});

		it("n'enchaîne pas si une redirection a eu lieu il y a moins de 10s", async () => {
			const location = { href: "", pathname: "/entreprises" };
			vi.stubGlobal("location", location);
			sessionStorage.setItem("authRedirectAt", String(Date.now()));

			const error = buildError();
			await expect(responseRejected(error)).rejects.toBe(error);

			expect(dispatchMock).not.toHaveBeenCalled();
		});

		it("laisse passer les erreurs non-401 sans effet de bord", async () => {
			const location = { href: "", pathname: "/entreprises" };
			vi.stubGlobal("location", location);

			const error = buildError({
				response: {
					status: 500,
					statusText: "Error",
					headers: {},
					config: {} as any,
					data: {},
				},
			});
			await expect(responseRejected(error)).rejects.toBe(error);

			expect(dispatchMock).not.toHaveBeenCalled();
			expect(location.href).toBe("");
		});
	});
});
