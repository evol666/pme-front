import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

i18n.use(initReactI18next).init({
  lng: 'fr',
  fallbackLng: 'fr',
  ns: ['common'],
  defaultNS: 'common',
  resources: {
    fr: {
      common: {
        app: {
          loading: 'Chargement...',
          error: 'Une erreur est survenue',
          retry: 'Réessayer',
          save: 'Enregistrer',
          cancel: 'Annuler',
          delete: 'Supprimer',
          confirm: 'Confirmer',
          back: 'Retour',
          next: 'Suivant',
          close: 'Fermer',
          search: 'Rechercher',
        },
        nav: {
          accueil: 'Accueil',
          analyses: 'Analyses',
          recommandations: 'Recommandations',
          documents: 'Documents',
          administration: 'Administration',
        },
        auth: {
          login: 'Se connecter',
          logout: 'Se déconnecter',
          unauthorized: 'Accès non autorisé',
        },
      },
    },
  },
  interpolation: { escapeValue: false },
});

export default i18n;
