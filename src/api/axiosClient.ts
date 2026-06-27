import axios from 'axios';
import { store } from '../store';
import { logout } from '../features/auth/authSlice';

const axiosClient = axios.create({
  baseURL: window.location.origin,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// Miroir du fetch override (main.tsx) : achemine les appels feature /api/* vers la
// gateway via /services/pme/api/*. Les endpoints d'auth/session sont servis par la
// gateway elle-même et ne doivent pas être réécrits. Sans cet interceptor, les
// appels axios /api/company/analyze ne passeraient pas par la gateway en prod.
const AUTH_PATHS = new Set(['/api/account', '/api/logout', '/api/auth-info']);

// Lit un cookie par nom (document.cookie est "name=value; name2=value2").
function readCookie(name: string): string | null {
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

axiosClient.interceptors.request.use((config) => {
  const url = config.url ?? '';
  if (url.startsWith('/api/') && !AUTH_PATHS.has(url)) {
    config.url = `/services/pme${url}`;
  }
  // CSRF défensif : si Spring Security émet un cookie XSRF-TOKEN (CookieCsrfTokenRepository),
  // on le renvoie en header X-XSRF-TOKEN sur les requêtes mutatives. Inoffensif quand le
  // cookie est absent (mode JWT bearer sans CSRF). Évite les 403 sur POST/PATCH/DELETE.
  const method = (config.method ?? 'get').toLowerCase();
  if (['post', 'put', 'patch', 'delete'].includes(method)) {
    const token = readCookie('XSRF-TOKEN');
    if (token) {
      config.headers = config.headers ?? {};
      config.headers['X-XSRF-TOKEN'] = token;
    }
  }
  return config;
});

axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Redirection vers l'IdP encadrée pour ne JAMAIS boucler :
      // - on ignore la sonde de session (/api/account), gérée par fetchAuthInfo
      //   + RequireAuth (sinon : redirige -> revient -> 401 -> redirige...) ;
      // - on n'enchaîne pas si on est déjà sur /oauth2/... ;
      // - garde temporel : 1 redirection / 10 s max. Si un endpoint fonctionnel
      //   renvoie un 401 *persistant* alors qu'on est connecté (ex. token non
      //   relayé par la gateway, rôle manquant), rediriger ne résout rien et
      //   boucle : on laisse alors le 401 remonter pour que l'UI l'affiche.
      const reqUrl = error.config?.url ?? '';
      const isAuthProbe = AUTH_PATHS.has(reqUrl);
      const alreadyRedirecting = window.location.pathname.startsWith('/oauth2/');
      const lastRedirect = Number(sessionStorage.getItem('authRedirectAt') ?? '0');
      const recentlyRedirected = Date.now() - lastRedirect < 10_000;
      if (!isAuthProbe && !alreadyRedirecting && !recentlyRedirected) {
        sessionStorage.setItem('authRedirectAt', String(Date.now()));
        store.dispatch(logout());
        window.location.href = '/oauth2/authorization/pme';
      }
    }
    return Promise.reject(error);
  }
);

export default axiosClient;
