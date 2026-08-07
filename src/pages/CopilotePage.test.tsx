import '@testing-library/jest-dom';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@athanor/test-utils';
import type { CopilotChat, CopilotChatMessage, CopilotInsight, CopilotState, CopilotSuggestion } from '@/api/copilot';
import CopilotePage from './CopilotePage';

/**
 * Tests du copilote : santé du service, historique des conversations,
 * envoi de messages, rappel de l'historique de saisie et volet contextuel.
 *
 * Les hooks TanStack Query de `@/api/copilot` sont doublés en bloc : ce qui
 * est testé ici, c'est l'écran, pas la couche réseau qui a ses propres tests.
 */

const hooks = vi.hoisted(() => ({
  useCopilotState: vi.fn(),
  useCopilotHealth: vi.fn(),
  useChats: vi.fn(),
  useChatMessages: vi.fn(),
  useCreateChat: vi.fn(),
  useSendChatMessage: vi.fn(),
  useUpdateChatTitle: vi.fn(),
  useArchiveChat: vi.fn(),
  useUnarchiveChat: vi.fn(),
  useAlertAction: vi.fn(),
}));

vi.mock('@/api/copilot', () => hooks);

/** Double de mutation TanStack Query, réduit à ce que la page utilise. */
function mutation(overrides: Record<string, unknown> = {}) {
  return {
    mutate: vi.fn(),
    mutateAsync: vi.fn().mockResolvedValue({ id: 'chat-neuf' }),
    isPending: false,
    ...overrides,
  };
}

const chat = (overrides: Partial<CopilotChat> = {}): CopilotChat => ({
  id: 'chat-1',
  title: 'Trésorerie Q3',
  archived: false,
  createdAt: '2026-08-01T09:00:00Z',
  lastActivity: '2026-08-05T14:30:00Z',
  ...overrides,
});

const message = (overrides: Partial<CopilotChatMessage> = {}): CopilotChatMessage => ({
  id: 'msg-1',
  chatId: 'chat-1',
  role: 'user',
  message: 'Quelles actions prioritaires cette semaine ?',
  createdDate: '2026-08-05T14:30:00Z',
  ...overrides,
});

const insight = (overrides: Partial<CopilotInsight> = {}): CopilotInsight => ({
  id: '42',
  type: 'RISQUE',
  severity: 'high',
  title: 'Trésorerie tendue',
  summary: 'Le solde projeté passe sous le seuil dans 21 jours.',
  confidence: 0.82,
  reasons: [],
  sources: [],
  suggested_action: {},
  metier_id: null,
  created_at: '2026-08-05T09:00:00Z',
  ...overrides,
});

const suggestion = (overrides: Partial<CopilotSuggestion> = {}): CopilotSuggestion => ({
  id: 'sug-1',
  kind: 'recommendation',
  title: 'Relancer les impayés de plus de 30 jours',
  summary: '',
  priority: 1,
  action: { action_id: 'a1', label: 'Relancer', kind: 'task', payload: {} },
  severity: 'medium',
  reasons: [],
  sources: [],
  ...overrides,
});

const etat = (overrides: Partial<CopilotState> = {}): CopilotState => ({
  suggestions: [suggestion()],
  insights: [insight()],
  priorities: [suggestion({ id: 'pri-1', kind: 'priority', title: 'Boucler le prévisionnel' })],
  generated_at: '2026-08-05T09:00:00Z',
  elapsed_ms: 120,
  backend: 'ollama',
  ...overrides,
});

/** Câble les doubles de hooks ; chaque test ne surcharge que ce qui l'intéresse. */
function brancher({
  state = etat(),
  stateLoading = false,
  health = { ollama_reachable: true, model: 'mistral', model_available: true, mock: false, latency_ms: 12 },
  healthLoading = false,
  chats = [chat()],
  chatsLoading = false,
  messages = [] as CopilotChatMessage[],
  messagesLoading = false,
  sendPending = false,
  createPending = false,
}: Record<string, unknown> = {}) {
  const refetch = vi.fn();
  const createChat = mutation({ isPending: createPending });
  const sendMessage = mutation({ isPending: sendPending });
  const updateTitle = mutation();
  const archive = mutation();
  const unarchive = mutation();
  const alertAction = mutation();

  hooks.useCopilotState.mockReturnValue({
    data: state,
    isLoading: stateLoading,
    refetch,
    isFetching: false,
  });
  hooks.useCopilotHealth.mockReturnValue({ data: health, isLoading: healthLoading });
  hooks.useChats.mockReturnValue({ data: chats, isLoading: chatsLoading });
  hooks.useChatMessages.mockReturnValue({ data: messages, isLoading: messagesLoading });
  hooks.useCreateChat.mockReturnValue(createChat);
  hooks.useSendChatMessage.mockReturnValue(sendMessage);
  hooks.useUpdateChatTitle.mockReturnValue(updateTitle);
  hooks.useArchiveChat.mockReturnValue(archive);
  hooks.useUnarchiveChat.mockReturnValue(unarchive);
  hooks.useAlertAction.mockReturnValue(alertAction);

  return { refetch, createChat, sendMessage, updateTitle, archive, unarchive, alertAction };
}

const afficher = () => renderWithProviders(<CopilotePage />);

/** Zone de saisie du message, désactivée tant qu'aucune conversation n'est ouverte. */
const zoneSaisie = () => screen.getByPlaceholderText(/Écrivez votre message|Sélectionnez une conversation/);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Copilote — santé du service', () => {
  it('annonce le service en ligne', () => {
    brancher();

    afficher();

    expect(screen.getByText('En ligne')).toBeInTheDocument();
  });

  it('signale le mode démo, qui ne produit pas de vraies réponses', () => {
    brancher({ health: { ollama_reachable: true, model: 'mock', model_available: false, mock: true, latency_ms: 1 } });

    afficher();

    expect(screen.getByText('Mode démo')).toBeInTheDocument();
  });

  it('signale le service hors ligne', () => {
    brancher({ health: { ollama_reachable: false, model: 'mistral', model_available: false, mock: false, latency_ms: 0 } });

    afficher();

    expect(screen.getByText('Hors ligne')).toBeInTheDocument();
  });

  it('reste lisible quand la santé est inconnue', () => {
    // `null` et non `undefined` : ce dernier réactiverait la valeur par défaut.
    brancher({ health: null, healthLoading: true });

    afficher();

    expect(screen.getByText('Hors ligne')).toBeInTheDocument();
  });

  it('recharge le contexte à la demande', () => {
    const { refetch } = brancher();
    afficher();

    fireEvent.click(screen.getByRole('button', { name: /Rafraîchir/ }));

    expect(refetch).toHaveBeenCalled();
  });
});

describe('Copilote — historique des conversations', () => {
  it('ouvre d’office la première conversation active', () => {
    brancher({ chats: [chat({ id: 'c-arch', title: 'Archivée', archived: true }), chat()] });

    afficher();

    expect(screen.getByRole('heading', { name: 'Trésorerie Q3' })).toBeInTheDocument();
  });

  it('n’ouvre rien quand toutes les conversations sont archivées', () => {
    brancher({ chats: [chat({ archived: true })] });

    afficher();

    expect(screen.getByText('Sélectionnez ou créez une conversation')).toBeInTheDocument();
    expect(zoneSaisie()).toBeDisabled();
  });

  it('invite à démarrer quand il n’y a aucune conversation', () => {
    brancher({ chats: [] });

    afficher();

    expect(screen.getByText('Aucune conversation. Cliquez sur + pour commencer.')).toBeInTheDocument();
  });

  it('affiche un chargement tant que la liste n’est pas arrivée', () => {
    brancher({ chats: [], chatsLoading: true });

    afficher();

    expect(screen.queryByText('Conversations')).not.toBeInTheDocument();
  });

  it('bascule entre conversations actives et archivées', () => {
    brancher({ chats: [chat(), chat({ id: 'c2', title: 'Ancienne piste', archived: true })] });
    afficher();

    fireEvent.click(screen.getByTitle('Voir les archivées'));

    expect(screen.getByText('Archivées')).toBeInTheDocument();
    expect(screen.getByText('Ancienne piste')).toBeInTheDocument();
  });

  it('annonce l’absence de conversation archivée', () => {
    brancher();
    afficher();

    fireEvent.click(screen.getByTitle('Voir les archivées'));

    expect(screen.getByText('Aucune conversation archivée.')).toBeInTheDocument();
  });

  it('archive une conversation active', () => {
    const { archive } = brancher();
    afficher();

    fireEvent.click(screen.getByTitle('Archiver'));

    expect(archive.mutate).toHaveBeenCalledWith('chat-1');
  });

  it('désarchive depuis la vue des archivées', () => {
    const { unarchive } = brancher({ chats: [chat({ archived: true })] });
    afficher();
    fireEvent.click(screen.getByTitle('Voir les archivées'));

    fireEvent.click(screen.getByTitle('Désarchiver'));

    expect(unarchive.mutate).toHaveBeenCalledWith('chat-1');
  });

  it('crée une conversation et l’ouvre', async () => {
    const { createChat } = brancher({ chats: [] });
    afficher();

    fireEvent.click(screen.getByTitle('Nouvelle conversation'));

    await waitFor(() => expect(createChat.mutateAsync).toHaveBeenCalledWith('Nouvelle conversation'));
  });

  it('bloque le bouton pendant la création', () => {
    brancher({ chats: [], createPending: true });

    afficher();

    expect(screen.getByTitle('Nouvelle conversation')).toBeDisabled();
  });

  it('ouvre la conversation choisie', () => {
    brancher({ chats: [chat(), chat({ id: 'c2', title: 'Recrutement' })] });
    afficher();

    fireEvent.click(screen.getByText('Recrutement'));

    expect(screen.getByRole('heading', { name: 'Recrutement' })).toBeInTheDocument();
  });
});

describe('Copilote — renommage', () => {
  it('renomme la conversation courante', () => {
    const { updateTitle } = brancher();
    afficher();
    fireEvent.click(screen.getByTitle('Renommer'));

    const champ = screen.getByPlaceholderText('Titre de la conversation');
    fireEvent.change(champ, { target: { value: 'Trésorerie Q4' } });
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));

    expect(updateTitle.mutate).toHaveBeenCalledWith({ chatId: 'chat-1', title: 'Trésorerie Q4' });
  });

  it('valide le renommage à la touche Entrée', () => {
    const { updateTitle } = brancher();
    afficher();
    fireEvent.click(screen.getByTitle('Renommer'));

    const champ = screen.getByPlaceholderText('Titre de la conversation');
    fireEvent.change(champ, { target: { value: 'Nouveau titre' } });
    fireEvent.keyDown(champ, { key: 'Enter' });

    expect(updateTitle.mutate).toHaveBeenCalledWith({ chatId: 'chat-1', title: 'Nouveau titre' });
  });

  it('abandonne le renommage à la touche Échap', () => {
    const { updateTitle } = brancher();
    afficher();
    fireEvent.click(screen.getByTitle('Renommer'));

    fireEvent.keyDown(screen.getByPlaceholderText('Titre de la conversation'), { key: 'Escape' });

    expect(updateTitle.mutate).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Trésorerie Q3' })).toBeInTheDocument();
  });

  it('abandonne le renommage au bouton Annuler', () => {
    const { updateTitle } = brancher();
    afficher();
    fireEvent.click(screen.getByTitle('Renommer'));

    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));

    expect(updateTitle.mutate).not.toHaveBeenCalled();
  });

  it('refuse un titre vide', () => {
    brancher();
    afficher();
    fireEvent.click(screen.getByTitle('Renommer'));

    fireEvent.change(screen.getByPlaceholderText('Titre de la conversation'), { target: { value: '   ' } });

    expect(screen.getByRole('button', { name: 'OK' })).toBeDisabled();
  });
});

describe('Copilote — conversation', () => {
  it('accueille l’utilisateur dès l’ouverture d’une conversation', () => {
    brancher();

    afficher();

    expect(screen.getByText(/Je suis votre Copilote IA/)).toBeInTheDocument();
  });

  it('affiche les messages échangés', () => {
    brancher({
      messages: [
        message(),
        message({ id: 'msg-2', role: 'assistant', message: 'Trois actions à mener.' }),
      ],
    });

    afficher();

    expect(screen.getByText('Quelles actions prioritaires cette semaine ?')).toBeInTheDocument();
    expect(screen.getByText('Trois actions à mener.')).toBeInTheDocument();
  });

  it('laisse l’heure vide plutôt que d’afficher une date invalide', () => {
    brancher({ messages: [message({ createdDate: 'pas-une-date' })] });

    afficher();

    // Sans la garde `Number.isNaN`, `format` lèverait et casserait tout le fil.
    expect(document.body.textContent).not.toContain('Invalid');
  });

  it('signale le chargement des messages', () => {
    brancher({ messagesLoading: true });

    afficher();

    expect(screen.getByText('Chargement…')).toBeInTheDocument();
  });

  it('indique que le copilote réfléchit pendant l’envoi', () => {
    brancher({ sendPending: true });

    afficher();

    expect(screen.getByText('Le copilote réfléchit…')).toBeInTheDocument();
  });
});

describe('Copilote — envoi de message', () => {
  it('envoie le message saisi et vide la zone', async () => {
    const { sendMessage } = brancher();
    afficher();

    fireEvent.change(zoneSaisie(), { target: { value: 'Analyse ma trésorerie' } });
    fireEvent.click(screen.getByTitle('Envoyer'));

    await waitFor(() =>
      expect(sendMessage.mutateAsync).toHaveBeenCalledWith({
        chatId: 'chat-1',
        message: 'Analyse ma trésorerie',
      }),
    );
    expect(zoneSaisie()).toHaveValue('');
  });

  it('envoie à la touche Entrée', async () => {
    const { sendMessage } = brancher();
    afficher();

    fireEvent.change(zoneSaisie(), { target: { value: 'Bonjour' } });
    fireEvent.keyDown(zoneSaisie(), { key: 'Enter', shiftKey: false });

    await waitFor(() => expect(sendMessage.mutateAsync).toHaveBeenCalled());
  });

  it('insère un retour à la ligne avec Maj+Entrée', () => {
    const { sendMessage } = brancher();
    afficher();

    fireEvent.change(zoneSaisie(), { target: { value: 'Première ligne' } });
    fireEvent.keyDown(zoneSaisie(), { key: 'Enter', shiftKey: true });

    expect(sendMessage.mutateAsync).not.toHaveBeenCalled();
  });

  it('refuse un message vide ou fait d’espaces', () => {
    const { sendMessage } = brancher();
    afficher();

    fireEvent.change(zoneSaisie(), { target: { value: '   ' } });
    fireEvent.keyDown(zoneSaisie(), { key: 'Enter' });

    expect(sendMessage.mutateAsync).not.toHaveBeenCalled();
    expect(screen.getByTitle('Envoyer')).toBeDisabled();
  });

  it('n’envoie rien tant qu’un envoi est en cours', () => {
    const { sendMessage } = brancher({ sendPending: true });
    afficher();

    fireEvent.keyDown(zoneSaisie(), { key: 'Enter' });

    expect(sendMessage.mutateAsync).not.toHaveBeenCalled();
  });
});

describe('Copilote — rappel de l’historique de saisie', () => {
  const messagesUtilisateur = [
    message({ id: 'm1', message: 'Première question' }),
    message({ id: 'm2', role: 'assistant', message: 'Réponse' }),
    message({ id: 'm3', message: 'Deuxième question' }),
  ];

  it('remonte au dernier message envoyé avec la flèche haut', () => {
    brancher({ messages: messagesUtilisateur });
    afficher();

    fireEvent.keyDown(zoneSaisie(), { key: 'ArrowUp' });

    expect(zoneSaisie()).toHaveValue('Deuxième question');
  });

  it('continue de remonter jusqu’au plus ancien puis s’y arrête', () => {
    brancher({ messages: messagesUtilisateur });
    afficher();

    fireEvent.keyDown(zoneSaisie(), { key: 'ArrowUp' });
    fireEvent.keyDown(zoneSaisie(), { key: 'ArrowUp' });
    fireEvent.keyDown(zoneSaisie(), { key: 'ArrowUp' });

    // Une fois au plus ancien, remonter encore ne doit pas sortir du tableau.
    expect(zoneSaisie()).toHaveValue('Première question');
  });

  it('redescend puis vide la zone au retour au présent', () => {
    brancher({ messages: messagesUtilisateur });
    afficher();

    fireEvent.keyDown(zoneSaisie(), { key: 'ArrowUp' });
    fireEvent.keyDown(zoneSaisie(), { key: 'ArrowUp' });
    fireEvent.keyDown(zoneSaisie(), { key: 'ArrowDown' });
    expect(zoneSaisie()).toHaveValue('Deuxième question');

    fireEvent.keyDown(zoneSaisie(), { key: 'ArrowDown' });
    expect(zoneSaisie()).toHaveValue('');
  });

  it('ignore la flèche bas quand on est déjà au présent', () => {
    brancher({ messages: messagesUtilisateur });
    afficher();
    fireEvent.change(zoneSaisie(), { target: { value: 'brouillon en cours' } });

    fireEvent.keyDown(zoneSaisie(), { key: 'ArrowDown' });

    // Le brouillon en cours ne doit pas être effacé par une flèche sans effet.
    expect(zoneSaisie()).toHaveValue('brouillon en cours');
  });

  it('ignore les flèches quand aucun message n’a encore été envoyé', () => {
    brancher({ messages: [] });
    afficher();
    fireEvent.change(zoneSaisie(), { target: { value: 'texte' } });

    fireEvent.keyDown(zoneSaisie(), { key: 'ArrowUp' });

    expect(zoneSaisie()).toHaveValue('texte');
  });
});

describe('Copilote — volet contextuel', () => {
  it('détaille les insights avec leur indice de confiance', () => {
    brancher();

    afficher();

    expect(screen.getByText('Insights (1)')).toBeInTheDocument();
    expect(screen.getByText('Trésorerie tendue')).toBeInTheDocument();
    expect(screen.getByText('82%')).toBeInTheDocument();
  });

  it('omet la confiance quand elle n’est pas calculée', () => {
    brancher({ state: etat({ insights: [insight({ confidence: null })] }) });

    afficher();

    expect(screen.getByText('Trésorerie tendue')).toBeInTheDocument();
    expect(screen.queryByText('82%')).not.toBeInTheDocument();
  });

  it('remonte l’action « Agir » sur un insight', () => {
    const { alertAction } = brancher();
    afficher();

    fireEvent.click(screen.getByRole('button', { name: /Agir/ }));

    expect(alertAction.mutate).toHaveBeenCalledWith({ alertId: 42, action: 'act' });
  });

  it('remonte l’action « Écarter » sur un insight', () => {
    const { alertAction } = brancher();
    afficher();

    fireEvent.click(screen.getByRole('button', { name: /Écarter/ }));

    expect(alertAction.mutate).toHaveBeenCalledWith({ alertId: 42, action: 'dismiss' });
  });

  it('nomme les types de suggestion et affiche leur priorité', () => {
    brancher();

    afficher();

    expect(screen.getByText('Reco')).toBeInTheDocument();
    expect(screen.getByText('Priorité')).toBeInTheDocument();
    expect(screen.getAllByText('P1').length).toBeGreaterThan(0);
  });

  it('reprend tel quel un type de suggestion inconnu', () => {
    brancher({
      state: etat({ suggestions: [suggestion({ kind: 'veille', priority: null })], priorities: [] }),
    });

    afficher();

    expect(screen.getByText('veille')).toBeInTheDocument();
    expect(screen.queryByText(/^P\d/)).not.toBeInTheDocument();
  });

  it('annonce l’absence d’alerte et de suggestion', () => {
    brancher({ state: etat({ insights: [], suggestions: [], priorities: [] }) });

    afficher();

    expect(screen.getByText('Aucune alerte active.')).toBeInTheDocument();
    expect(screen.getByText('Lancez une analyse pour générer des suggestions.')).toBeInTheDocument();
    expect(screen.queryByText(/^Priorités/)).not.toBeInTheDocument();
  });

  it('affiche un chargement tant que le contexte n’est pas arrivé', () => {
    brancher({ state: null, stateLoading: true });

    afficher();

    expect(screen.getByText('Chargement du contexte…')).toBeInTheDocument();
  });

  it('reste utilisable quand le contexte revient vide', () => {
    brancher({ state: null });

    afficher();

    expect(screen.getByText('Insights (0)')).toBeInTheDocument();
    expect(screen.getByText('Suggestions (0)')).toBeInTheDocument();
  });
});

describe('Copilote — vue mobile', () => {
  it('ouvre puis referme l’historique en pleine page', () => {
    // Sous 768 px, l'historique passe en surcouche et se ferme à la croix.
    vi.mocked(globalThis.matchMedia).mockReturnValue({
      matches: true,
      media: '(max-width: 768px)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as MediaQueryList);
    brancher();
    const { container } = afficher();

    expect(screen.queryByText('Conversations')).not.toBeInTheDocument();

    fireEvent.click(container.querySelector('.w-8.h-8') as HTMLElement);

    expect(screen.getByText('Conversations')).toBeInTheDocument();
  });
});
