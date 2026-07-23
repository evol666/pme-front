import { describe, expect, it } from "vitest";
import { store } from "./store";

describe("store", () => {
	it("expose le reducer auth avec son état initial", () => {
		expect(store.getState().auth).toEqual({
			username: null,
			email: null,
			roles: [],
			isAuthenticated: false,
			sessionChecked: false,
		});
	});

	it("répond aux actions dispatchées sur le slice auth", () => {
		store.dispatch({
			type: "auth/setUser",
			payload: { login: "jdoe", authorities: ["ROLE_USER"] },
		});
		expect(store.getState().auth.username).toBe("jdoe");
		expect(store.getState().auth.isAuthenticated).toBe(true);

		store.dispatch({ type: "auth/logout" });
		expect(store.getState().auth.isAuthenticated).toBe(false);
	});
});
