import * as AuthSession from 'expo-auth-session';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { AppState, Platform } from 'react-native';
import { getSetting, setSetting } from '../../db/repositories/settings.repo';
import { clearClassroomTokens, getClassroomTokens, setClassroomTokens, type ClassroomTokens } from './tokenStore';
import { CLASSROOM_SCOPES, GOOGLE_REVOKE_ENDPOINT, GOOGLE_TOKEN_ENDPOINT } from './config';

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

interface GoogleTokenClient {
  requestAccessToken: (options?: { prompt?: string }) => void;
}

interface GoogleIdentityServices {
  accounts: {
    oauth2: {
      initTokenClient: (options: {
        client_id: string;
        scope: string;
        login_hint?: string;
        callback: (response: GoogleTokenResponse) => void;
        error_callback: (error: { type: string; message?: string }) => void;
      }) => GoogleTokenClient;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentityServices;
  }
}

export class ClassroomNotConnectedError extends Error {
  constructor(message = 'A ligação ao Google Classroom não está ativa.') {
    super(message);
    this.name = 'ClassroomNotConnectedError';
  }
}

class ClassroomRefreshTokenInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClassroomRefreshTokenInvalidError';
  }
}

const WEB_CLIENT_ID_KEY = 'ostudy.classroom.clientId';

export async function getClassroomClientId(): Promise<string | null> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const storedClientId = window.localStorage.getItem(WEB_CLIENT_ID_KEY);
    if (storedClientId) return storedClientId;

    const legacyClientId = await getSetting<string | null>('classroom.clientId', null);
    if (legacyClientId) window.localStorage.setItem(WEB_CLIENT_ID_KEY, legacyClientId);
    return legacyClientId;
  }
  return getSetting<string | null>('classroom.clientId', null);
}

export async function setClassroomClientId(id: string): Promise<void> {
  const value = id.trim();
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') throw new Error('O armazenamento local não está disponível.');
    if (value) window.localStorage.setItem(WEB_CLIENT_ID_KEY, value);
    else window.localStorage.removeItem(WEB_CLIENT_ID_KEY);
    return;
  }
  await setSetting('classroom.clientId', value || null);
}

export async function getClassroomAccountEmail(): Promise<string | null> {
  const tokens = await getClassroomTokens();
  return tokens?.account_email ?? null;
}

async function getAuthorizedAccountEmail(accessToken: string): Promise<string> {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: 'Bearer '.concat(accessToken) },
  });
  if (!response.ok) {
    throw new Error('Não foi possível identificar a conta Google autorizada. Reconecte o Classroom e aceite a permissão de e-mail.');
  }
  const profile = await response.json() as { email?: string };
  if (!profile.email) throw new Error('O Google não informou o e-mail da conta autorizada.');
  return profile.email;
}

function addTokenFormValue(params: URLSearchParams, key: string, value: string | undefined): void {
  if (value) params.append(key, value);
}

let googleIdentityServicesPromise: Promise<void> | null = null;
let webTokenRefreshPromise: Promise<string | null> | null = null;
let tokenRefreshPromise: Promise<string | null> | null = null;
let sessionRefreshTimer: ReturnType<typeof setTimeout> | null = null;
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;
const TOKEN_REFRESH_RETRY_MS = 5 * 60 * 1000;
const CLASSROOM_ACCESS_TOKEN_LIFETIME_MS = 60 * 60 * 1000;
let nativeGoogleSignInConfigured = false;

function configureNativeGoogleSignIn(): void {
  if (nativeGoogleSignInConfigured) return;
  GoogleSignin.configure();
  nativeGoogleSignInConfigured = true;
}

function scheduleClassroomTokenRefresh(tokens: ClassroomTokens, delay?: number): void {
  if (sessionRefreshTimer) clearTimeout(sessionRefreshTimer);
  if (Platform.OS === 'web') return;
  const wait = delay ?? Math.max(1000, tokens.expires_at - Date.now() - TOKEN_REFRESH_BUFFER_MS);
  sessionRefreshTimer = setTimeout(() => {
    void (async () => {
      const accessToken = await getValidAccessToken();
      const storedTokens = await getClassroomTokens();
      if (storedTokens) {
        scheduleClassroomTokenRefresh(
          storedTokens,
          accessToken ? undefined : TOKEN_REFRESH_RETRY_MS,
        );
      }
    })().catch(error => {
      console.warn('Could not maintain Google Classroom authorization:', error);
    });
  }, wait);
}

async function saveClassroomTokens(tokens: ClassroomTokens): Promise<void> {
  await setClassroomTokens(tokens);
  scheduleClassroomTokenRefresh(tokens);
}

async function removeClassroomTokens(): Promise<void> {
  if (sessionRefreshTimer) {
    clearTimeout(sessionRefreshTimer);
    sessionRefreshTimer = null;
  }
  await clearClassroomTokens();
}

export function startClassroomSessionMaintenance(): () => void {
  if (Platform.OS === 'web') return () => {};

  let active = true;
  const refreshIfNeeded = async () => {
    const tokens = await getClassroomTokens();
    if (!active || !tokens) return;
    if (Date.now() + TOKEN_REFRESH_BUFFER_MS >= tokens.expires_at) {
      const accessToken = await getValidAccessToken();
      if (!accessToken) {
        const storedTokens = await getClassroomTokens();
        if (storedTokens) scheduleClassroomTokenRefresh(storedTokens, TOKEN_REFRESH_RETRY_MS);
      }
    } else {
      scheduleClassroomTokenRefresh(tokens);
    }
  };
  const handleAppState = (state: string) => {
    if (state === 'active') {
      void refreshIfNeeded().catch(error => console.warn('Could not refresh Google Classroom session:', error));
    }
  };
  const appStateSubscription = AppState.addEventListener('change', handleAppState);
  void refreshIfNeeded().catch(error => console.warn('Could not initialize Google Classroom session:', error));

  return () => {
    active = false;
    appStateSubscription.remove();
    if (sessionRefreshTimer) {
      clearTimeout(sessionRefreshTimer);
      sessionRefreshTimer = null;
    }
  };
}

export function prepareClassroomWebAuth(): Promise<void> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return Promise.resolve();
  if (window.google?.accounts.oauth2) return Promise.resolve();
  if (googleIdentityServicesPromise) return googleIdentityServicesPromise;

  const loadingPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[data-google-identity-services]');
    const script = existingScript ?? document.createElement('script');

    const onLoad = () => {
      if (window.google?.accounts.oauth2) resolve();
      else reject(new Error('O Google Identity Services carregou sem disponibilizar o OAuth.'));
    };
    const onError = () => reject(new Error('Não foi possível carregar o serviço de autenticação do Google.'));

    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener('error', onError, { once: true });

    if (!existingScript) {
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.dataset.googleIdentityServices = 'true';
      document.head.appendChild(script);
    }

    if (window.google?.accounts.oauth2) onLoad();
  }).catch((error: unknown) => {
    googleIdentityServicesPromise = null;
    throw error;
  });

  googleIdentityServicesPromise = loadingPromise;
  return loadingPromise;
}

async function exchangeAuthorizationCode(
  clientId: string,
  redirectUri: string,
  code: string,
  codeVerifier: string | undefined,
): Promise<void> {
  const form = new URLSearchParams();
  form.append('client_id', clientId);
  form.append('code', code);
  form.append('grant_type', 'authorization_code');
  form.append('redirect_uri', redirectUri);
  addTokenFormValue(form, 'code_verifier', codeVerifier);

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });

  const json = await response.json() as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error_description?: string;
  };
  if (!response.ok) {
    throw new Error(json.error_description || 'O Google não conseguiu concluir a ligação ao Classroom.');
  }
  if (!json.access_token || !json.refresh_token || !json.expires_in) {
    throw new Error('O Google não devolveu tokens válidos. Confirma os escopos e tenta autorizar novamente.');
  }

  const accountEmail = await getAuthorizedAccountEmail(json.access_token);
  await saveClassroomTokens({
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_at: Date.now() + (json.expires_in * 1000),
    account_email: accountEmail,
  });
}

export async function connectClassroom(clientIdValue?: string): Promise<void> {
  if (Platform.OS === 'android') {
    configureNativeGoogleSignIn();
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const signInResult = await GoogleSignin.signIn();
    if (signInResult.type !== 'success') {
      throw new Error('A autorização foi cancelada.');
    }

    const authorizationResult = await GoogleSignin.addScopes({ scopes: CLASSROOM_SCOPES });
    if (!authorizationResult || authorizationResult.type !== 'success') {
      throw new Error('A autorização do Google Classroom foi cancelada.');
    }

    const { accessToken } = await GoogleSignin.getTokens();
    if (!accessToken) throw new Error('O Google não devolveu um token de acesso válido.');

    await saveClassroomTokens({
      access_token: accessToken,
      expires_at: Date.now() + CLASSROOM_ACCESS_TOKEN_LIFETIME_MS,
      account_email: authorizationResult.data.user.email,
    });
    return;
  }

  const clientId = clientIdValue?.trim() || await getClassroomClientId();
  if (!clientId) throw new Error('Cola primeiro o teu Client ID do Google Cloud Console.');

  if (Platform.OS === 'web') {
    if (typeof window === 'undefined' || !window.google?.accounts.oauth2) {
      throw new Error('A autenticação do Google ainda está a carregar. Aguarda alguns segundos e tenta novamente.');
    }

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      let authorizationResponseReceived = false;
      let popupClosedTimer: ReturnType<typeof setTimeout> | null = null;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        if (popupClosedTimer) clearTimeout(popupClosedTimer);
        if (error) reject(error);
        else resolve();
      };

      const tokenClient = window.google!.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: CLASSROOM_SCOPES.join(' '),
        callback: (response) => {
          authorizationResponseReceived = true;
          if (popupClosedTimer) {
            clearTimeout(popupClosedTimer);
            popupClosedTimer = null;
          }
          if (response.error) {
            finish(new Error(response.error_description || `A autorização do Google falhou: ${response.error}`));
            return;
          }
          if (!response.access_token || !response.expires_in) {
            finish(new Error('O Google não devolveu um token de acesso válido.'));
            return;
          }

          void (async () => {
            const accountEmail = await getAuthorizedAccountEmail(response.access_token!);
            await saveClassroomTokens({
              access_token: response.access_token!,
              expires_at: Date.now() + response.expires_in! * 1000,
              account_email: accountEmail,
            });
            await setClassroomClientId(clientId);
            finish();
          })().catch((error: unknown) => {
            finish(error instanceof Error ? error : new Error(String(error)));
          });
        },
        error_callback: (error) => {
          if (authorizationResponseReceived && error.type === 'popup_closed') return;
          if (error.type === 'popup_closed') {
            if (!popupClosedTimer) {
              popupClosedTimer = setTimeout(() => {
                finish(new Error(
                  'A janela do Google fechou sem devolver a autorização ao OStudy. Tenta novamente e permite pop-ups para este site.',
                ));
              }, 2000);
            }
            return;
          }
          finish(new Error(error.message || `A janela de autorização do Google falhou: ${error.type}`));
        },
      });

      tokenClient.requestAccessToken({ prompt: 'select_account consent' });
    });
    return;
  }

  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'ostudy' });
  const request = new AuthSession.AuthRequest({
    clientId,
    scopes: CLASSROOM_SCOPES,
    redirectUri,
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true,
    extraParams: { access_type: 'offline', prompt: 'select_account consent' },
  });

  const discovery = await AuthSession.fetchDiscoveryAsync('https://accounts.google.com');
  const result = await request.promptAsync(discovery);
  if (result.type !== 'success' || !result.params.code) {
    const detail = result.type === 'error'
      ? result.error?.message || result.params.error_description || result.params.error
      : result.type === 'cancel' || result.type === 'dismiss'
        ? 'A autorização foi cancelada.'
        : `A autorização terminou sem código (estado: ${result.type}).`;
    throw new Error(detail || 'Não foi possível concluir a ligação ao Google Classroom.');
  }

  await exchangeAuthorizationCode(clientId, redirectUri, result.params.code, request.codeVerifier);
}

export async function disconnectClassroom(): Promise<void> {
  const tokens = await getClassroomTokens();
  if (Platform.OS === 'android' && GoogleSignin.hasPreviousSignIn()) {
    try {
      configureNativeGoogleSignIn();
      await GoogleSignin.revokeAccess();
    } catch (error) {
      console.warn('Could not revoke native Google Classroom authorization cleanly:', error);
    }
  }
  if (tokens) {
    try {
      await fetch(GOOGLE_REVOKE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: tokens.refresh_token || tokens.access_token }).toString(),
      });
    } catch (error) {
      console.warn('Could not revoke Classroom token cleanly:', error);
    }
  }
  await removeClassroomTokens();
}

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; refresh_token?: string; expires_in: number }> {
  const clientId = await getClassroomClientId();
  if (!clientId) throw new Error('Missing Google Classroom client ID.');
  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
  });

  const json = await response.json() as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!response.ok) {
    const message = json.error_description || 'O Google não conseguiu renovar a autorização do Classroom.';
    if (json.error === 'invalid_grant') throw new ClassroomRefreshTokenInvalidError(message);
    throw new Error(message);
  }
  if (!json.access_token || !json.expires_in) {
    throw new Error('O Google não devolveu um access token válido.');
  }

  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token || refreshToken,
    expires_in: json.expires_in,
  };
}

async function refreshWebAccessToken(): Promise<string | null> {
  if (webTokenRefreshPromise) return webTokenRefreshPromise;

  webTokenRefreshPromise = (async () => {
    await prepareClassroomWebAuth();
    const clientId = await getClassroomClientId();
    const tokens = await getClassroomTokens();
    if (!clientId || !tokens || !window.google?.accounts.oauth2) return null;

    return new Promise<string | null>((resolve, reject) => {
      let settled = false;
      const finish = (token: string | null, error?: Error) => {
        if (settled) return;
        settled = true;
        if (error) reject(error);
        else resolve(token);
      };

      const tokenClient = window.google!.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: CLASSROOM_SCOPES.join(' '),
        login_hint: tokens.account_email,
        callback: (response) => {
          if (response.error || !response.access_token || !response.expires_in) {
            finish(null, new Error(response.error_description || response.error || 'O Google não renovou a autorização do Classroom.'));
            return;
          }

          void saveClassroomTokens({
            ...tokens,
            access_token: response.access_token,
            expires_at: Date.now() + response.expires_in * 1000,
          }).then(() => finish(response.access_token!))
            .catch(error => finish(null, error instanceof Error ? error : new Error(String(error))));
        },
        error_callback: (error) => finish(null, new Error(error.message || `A renovação da autorização falhou: ${error.type}`)),
      });

      try {
        tokenClient.requestAccessToken({ prompt: 'none' });
      } catch (error) {
        finish(null, error instanceof Error ? error : new Error(String(error)));
      }
    });
  })().finally(() => {
    webTokenRefreshPromise = null;
  });

  return webTokenRefreshPromise;
}

async function resolveValidAccessToken(): Promise<string | null> {
  const tokens = await getClassroomTokens();
  if (!tokens) return null;

  const now = Date.now();
  if (now + TOKEN_REFRESH_BUFFER_MS < tokens.expires_at) return tokens.access_token;
  if (Platform.OS === 'android') {
    try {
      configureNativeGoogleSignIn();
      if (!GoogleSignin.hasPreviousSignIn()) return null;
      const { accessToken } = await GoogleSignin.getTokens();
      if (!accessToken) return null;

      const next = {
        access_token: accessToken,
        expires_at: Date.now() + CLASSROOM_ACCESS_TOKEN_LIFETIME_MS,
        account_email: GoogleSignin.getCurrentUser()?.user.email ?? tokens.account_email,
      };
      await saveClassroomTokens(next);
      return next.access_token;
    } catch (error) {
      console.warn('Could not renew native Google Classroom authorization:', error);
      return null;
    }
  }
  if (!tokens.refresh_token) {
    if (Platform.OS === 'web') {
      try {
        return await refreshWebAccessToken();
      } catch (error) {
        console.warn('Could not renew Google Classroom web authorization:', error);
        return null;
      }
    }
    await removeClassroomTokens();
    return null;
  }

  try {
    const refreshed = await refreshAccessToken(tokens.refresh_token);
    const next = {
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token ?? tokens.refresh_token,
      expires_at: Date.now() + refreshed.expires_in * 1000,
      account_email: tokens.account_email,
    };
    await saveClassroomTokens(next);
    return next.access_token;
  } catch (error) {
    if (error instanceof ClassroomRefreshTokenInvalidError) {
      await removeClassroomTokens();
    } else {
      console.warn('Could not renew Google Classroom authorization:', error);
    }
    return null;
  }
}

export function getValidAccessToken(): Promise<string | null> {
  if (!tokenRefreshPromise) {
    tokenRefreshPromise = resolveValidAccessToken().finally(() => {
      tokenRefreshPromise = null;
    });
  }
  return tokenRefreshPromise;
}

export async function hasClassroomConnection(): Promise<boolean> {
  const tokens = await getClassroomTokens();
  if (!tokens) return false;
  if (Platform.OS === 'web') return true;
  if (Platform.OS === 'android') {
    return GoogleSignin.hasPreviousSignIn() && Date.now() < tokens.expires_at;
  }
  return Boolean(tokens.refresh_token || Date.now() < tokens.expires_at);
}
