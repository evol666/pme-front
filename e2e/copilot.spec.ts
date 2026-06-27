import { expect, test } from "@playwright/test";
import { mockGlobalApis } from "./helpers";

test.describe("AI Copilot", () => {
	test.beforeEach(async ({ page }) => {
		// Authenticated and onboarding done
		await mockGlobalApis(page, { onboardingCompleted: true });
	});

	test("should display chat assistant, health badge, send message, and act on insights", async ({
		page,
	}) => {
		// Mock copilot health
		await page.route(/\/api\/copilot\/health$/, async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					ollama_reachable: true,
					model: "llama3",
					model_available: true,
					mock: false,
					latency_ms: 120,
				}),
			});
		});

		// Mock copilot state (insights & suggestions)
		await page.route(/\/api\/copilot\/state/, async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					suggestions: [
						{
							id: "sug-1",
							kind: "recommendation",
							title: "Augmenter la visibilité web",
							summary: "Installer un module SEO",
							priority: 1,
							action: {
								action_id: "act-seo",
								label: "Installer SEO",
								kind: "install",
								payload: {},
							},
							severity: "low",
							reasons: [],
							sources: [],
						},
					],
					insights: [
						{
							id: "101",
							type: "Alerte Trésorerie",
							severity: "high",
							title: "Cashflow négatif prévu",
							summary: "Votre solde risque de passer sous le seuil critique.",
							confidence: 0.88,
							reasons: [],
							sources: [],
							suggested_action: {},
							metier_id: null,
							created_at: new Date().toISOString(),
						},
					],
					priorities: [],
					generated_at: new Date().toISOString(),
					elapsed_ms: 15,
					backend: "Ollama",
				}),
			});
		});

		// Mock chats list — needed for the page to not call the real backend (which would return 401)
		await page.route(/\/api\/copilot\/chats$/, async (route) => {
			if (route.request().method() === "GET") {
				await route.fulfill({
					status: 200,
					contentType: "application/json",
					body: JSON.stringify([
						{
							id: "chat-1",
							title: "Conversation test",
							archived: false,
							createdAt: new Date().toISOString(),
							lastActivity: new Date().toISOString(),
						},
					]),
				});
			} else {
				await route.fallback();
			}
		});

		// Mock chat messages — single handler for GET (list) and POST (send)
		let messagesSent = false;
		await page.route(
			/\/api\/copilot\/chats\/chat-1\/messages$/,
			async (route) => {
				if (route.request().method() === "POST") {
					messagesSent = true;
					await route.fulfill({
						status: 200,
						contentType: "application/json",
						body: JSON.stringify({
							id: "2",
							chatId: "chat-1",
							role: "assistant",
							message: "Bonjour ! Comment puis-je vous aider aujourd'hui ?",
							createdDate: new Date().toISOString(),
						}),
					});
				} else {
					await route.fulfill({
						status: 200,
						contentType: "application/json",
						body: JSON.stringify(
							messagesSent
								? [
										{
											id: "1",
											chatId: "chat-1",
											role: "user",
											message: "Bonjour Copilote",
											createdDate: new Date().toISOString(),
										},
										{
											id: "2",
											chatId: "chat-1",
											role: "assistant",
											message:
												"Bonjour ! Comment puis-je vous aider aujourd'hui ?",
											createdDate: new Date().toISOString(),
										},
									]
								: [],
						),
					});
				}
			},
		);

		// Mock alert action
		let actionTriggered = false;
		await page.route(/\/api\/copilot\/v2\/alerts\/101\/act$/, async (route) => {
			actionTriggered = true;
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({ success: true }),
			});
		});

		await page.goto("/copilote");

		// Verify page header
		await expect(page.locator("main h1")).toContainText("Copilote IA");

		// Verify health badge shows "En ligne"
		await expect(page.locator("text=En ligne")).toBeVisible();

		// Verify suggestion is visible
		await expect(
			page.locator("text=Augmenter la visibilité web"),
		).toBeVisible();

		// Verify insight is visible
		await expect(page.locator("text=Cashflow négatif prévu")).toBeVisible();

		// Perform alert action "Agir" — force:true because copilot state polling causes continuous re-renders
		await page
			.locator('button:has-text("Agir")')
			.first()
			.click({ force: true });
		expect(actionTriggered).toBe(true);

		// Send a message — currentChatId is auto-set to 'chat-1' by the page's auto-select effect
		await page.fill(
			'textarea[placeholder*="Écrivez votre message"]',
			"Bonjour Copilote",
		);
		await page.click('button[title="Envoyer"]');

		// Verify sent message is in the chat
		await expect(page.locator("text=Bonjour Copilote")).toBeVisible();

		// Verify assistant reply or static greeting is rendered
		await expect(
			page
				.locator("text=Bonjour ! Comment puis-je vous aider aujourd'hui")
				.first(),
		).toBeVisible();
	});
});
