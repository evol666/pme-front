import { beforeEach, describe, expect, it } from 'vitest';
import { usePersonaStore } from './personaStore';

describe('usePersonaStore', () => {
  beforeEach(() => {
    usePersonaStore.setState({ activePersonaId: null });
    localStorage.clear();
  });

  it('starts with no active persona', () => {
    expect(usePersonaStore.getState().activePersonaId).toBeNull();
  });

  it('setActivePersona updates the active persona id', () => {
    usePersonaStore.getState().setActivePersona(42);
    expect(usePersonaStore.getState().activePersonaId).toBe(42);
  });

  it('clearActivePersona resets the active persona id to null', () => {
    usePersonaStore.getState().setActivePersona(7);
    usePersonaStore.getState().clearActivePersona();
    expect(usePersonaStore.getState().activePersonaId).toBeNull();
  });

  it('persists the active persona to localStorage', () => {
    usePersonaStore.getState().setActivePersona(5);
    const raw = localStorage.getItem('pme-active-persona');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string);
    expect(parsed.state.activePersonaId).toBe(5);
  });
});
