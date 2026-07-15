import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axiosClient from '@/api/axiosClient';
import type { RootState } from '../../store';

interface OnboardingState {
  onboarding_completed: boolean;
}

export default function RequireAuth({ children }: { readonly children: React.ReactNode }) {
  const { isAuthenticated, sessionChecked } = useSelector((s: RootState) => s.auth);
  const navigate = useNavigate();
  const location = useLocation();

  const { data: onboarding } = useQuery({
    queryKey: ['onboarding', 'state'],
    enabled: isAuthenticated && sessionChecked,
    queryFn: async () => {
      const { data } = await axiosClient.get<OnboardingState>('/api/onboarding/state');
      return data;
    },
    // Une seule vérification au démarrage suffit
    staleTime: Infinity,
    retry: false,
  });

  useEffect(() => {
    if (sessionChecked && !isAuthenticated) {
      window.location.href = '/oauth2/authorization/pme';
    }
  }, [isAuthenticated, sessionChecked]);

  // Rediriger vers onboarding si pas terminé (sauf si déjà sur /onboarding)
  useEffect(() => {
    if (
      isAuthenticated &&
      onboarding &&
      !onboarding.onboarding_completed &&
      !location.pathname.startsWith('/onboarding')
    ) {
      navigate('/onboarding', { replace: true });
    }
  }, [isAuthenticated, onboarding, location.pathname, navigate]);

  if (!sessionChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <div className="text-sm text-muted-foreground">Vérification de la session...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;
  return <>{children}</>;
}
