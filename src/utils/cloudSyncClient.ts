import {
  CloudEntitlement,
  CloudSyncState,
  ConflictItem,
  PlannerBackupData,
} from '../types/planner';
import {
  STORAGE_KEY_CLOUD_SESSION,
  STORAGE_KEY_CLOUD_SYNC_STATE,
  SimpleStorageLike,
} from './storageCoordinator';
import { validateBackupData } from './backupValidator';

export interface CloudUserProfile {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  entitlement: CloudEntitlement;
}

export interface CloudClientOptions {
  endpointUrl?: string;
  token?: string | null;
  storage?: SimpleStorageLike | null;
  fetchImpl?: typeof fetch;
}

function getDefaultStorage(): SimpleStorageLike | null {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    // ignore
  }
  return null;
}

export function getDefaultCloudEndpointUrl(): string {
  try {
    const env = (import.meta as any)?.env;
    if (env?.VITE_CLOUD_API_URL && typeof env.VITE_CLOUD_API_URL === 'string') {
      return env.VITE_CLOUD_API_URL.trim().replace(/\/+$/, '');
    }
  } catch {
    // ignore
  }
  return '';
}

export function getStoredCloudToken(
  storage: SimpleStorageLike | null = getDefaultStorage()
): string | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY_CLOUD_SESSION);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed?.token === 'string' && parsed.token.length > 0 ? parsed.token : null;
  } catch {
    return null;
  }
}

export function saveStoredCloudToken(
  token: string | null,
  storage: SimpleStorageLike | null = getDefaultStorage()
): void {
  if (!storage) return;
  try {
    if (!token) {
      storage.removeItem(STORAGE_KEY_CLOUD_SESSION);
    } else {
      storage.setItem(
        STORAGE_KEY_CLOUD_SESSION,
        JSON.stringify({ token, savedAt: new Date().toISOString() })
      );
    }
  } catch {
    // ignore storage errors
  }
}

export function getStoredCloudSyncState(
  storage: SimpleStorageLike | null = getDefaultStorage()
): CloudSyncState {
  const defaultState: CloudSyncState = {
    status: 'local_only',
    endpointUrl: getDefaultCloudEndpointUrl(),
  };
  if (!storage) return defaultState;
  try {
    const raw = storage.getItem(STORAGE_KEY_CLOUD_SYNC_STATE);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return defaultState;
    const token = getStoredCloudToken(storage);
    // Never claim connected cloud state if there is no active session token
    if (!token) {
      return {
        status: 'local_only',
        endpointUrl:
          typeof parsed.endpointUrl === 'string'
            ? parsed.endpointUrl
            : getDefaultCloudEndpointUrl(),
      };
    }
    const accountUserId = parsed.accountUserId || parsed.accountId;
    const accountEmail = parsed.accountEmail || parsed.email;
    return {
      status: parsed.status || 'local_only',
      endpointUrl:
        typeof parsed.endpointUrl === 'string'
          ? parsed.endpointUrl
          : getDefaultCloudEndpointUrl(),
      accountId: accountUserId,
      email: accountEmail,
      accountUserId,
      accountEmail,
      accountDisplayName: parsed.accountDisplayName,
      serverRevision:
        typeof parsed.serverRevision === 'number' ? parsed.serverRevision : undefined,
      etag: parsed.etag,
      lastSyncedAt: parsed.lastSyncedAt,
      lastSyncError: parsed.lastSyncError ?? null,
      entitlement: parsed.entitlement,
    };
  } catch {
    return defaultState;
  }
}

export function saveStoredCloudSyncState(
  state: CloudSyncState,
  storage: SimpleStorageLike | null = getDefaultStorage()
): CloudSyncState {
  const normalized: CloudSyncState = {
    ...state,
    accountId: state.accountUserId || state.accountId,
    email: state.accountEmail || state.email,
    accountUserId: state.accountUserId || state.accountId,
    accountEmail: state.accountEmail || state.email,
  };
  if (storage) {
    try {
      storage.setItem(STORAGE_KEY_CLOUD_SYNC_STATE, JSON.stringify(normalized));
    } catch {
      // ignore
    }
  }
  return normalized;
}

export function getCloudApiBaseUrl(
  storage: SimpleStorageLike | null = getDefaultStorage()
): string {
  const stored = getStoredCloudSyncState(storage);
  return (stored.endpointUrl || getDefaultCloudEndpointUrl()).trim().replace(/\/+$/, '');
}

export function setCloudApiBaseUrl(
  endpointUrl: string,
  storage: SimpleStorageLike | null = getDefaultStorage()
): void {
  const cleanUrl = (endpointUrl || '').trim().replace(/\/+$/, '');
  if (!storage) return;
  try {
    const raw = storage.getItem(STORAGE_KEY_CLOUD_SYNC_STATE);
    const parsed = raw ? JSON.parse(raw) : {};
    storage.setItem(
      STORAGE_KEY_CLOUD_SYNC_STATE,
      JSON.stringify({
        ...parsed,
        status: parsed.status || 'local_only',
        endpointUrl: cleanUrl,
      })
    );
  } catch {
    // ignore
  }
}

export const STORAGE_KEY_CLOUD_ACK_BASE_PREFIX = 'our_life_planner_cloud_ack_base_v1_';

export interface StoredCloudAckBase {
  snapshot: PlannerBackupData;
  serverRevision: number;
  etag: string;
  acknowledgedAt: string;
}

export function getStoredCloudAckBase(
  userId: string,
  storage: SimpleStorageLike | null = getDefaultStorage()
): StoredCloudAckBase | null {
  if (!storage || !userId) return null;
  try {
    const raw = storage.getItem(`${STORAGE_KEY_CLOUD_ACK_BASE_PREFIX}${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.snapshot && typeof parsed.serverRevision === 'number') {
      return parsed as StoredCloudAckBase;
    }
  } catch {
    // ignore
  }
  return null;
}

export function saveStoredCloudAckBase(
  userId: string,
  ack: StoredCloudAckBase,
  storage: SimpleStorageLike | null = getDefaultStorage()
): void {
  if (!storage || !userId) return;
  try {
    storage.setItem(`${STORAGE_KEY_CLOUD_ACK_BASE_PREFIX}${userId}`, JSON.stringify(ack));
  } catch {
    // ignore
  }
}

export function clearStoredCloudAckBase(
  userId: string,
  storage: SimpleStorageLike | null = getDefaultStorage()
): void {
  if (!storage || !userId) return;
  try {
    storage.removeItem(`${STORAGE_KEY_CLOUD_ACK_BASE_PREFIX}${userId}`);
  } catch {
    // ignore
  }
}

export function clearCloudSession(
  storage: SimpleStorageLike | null = getDefaultStorage()
): void {
  saveStoredCloudToken(null, storage);
  const endpointUrl = getCloudApiBaseUrl(storage);
  saveStoredCloudSyncState(
    {
      status: 'local_only',
      endpointUrl,
    },
    storage
  );
}

function normalizeEndpoint(endpointUrl?: string, storage?: SimpleStorageLike | null): string {
  if (endpointUrl !== undefined) {
    return endpointUrl.trim().replace(/\/+$/, '');
  }
  const stored = getStoredCloudSyncState(storage);
  return (stored.endpointUrl || getDefaultCloudEndpointUrl()).trim().replace(/\/+$/, '');
}

export async function registerCloudAccount(
  params: {
    email: string;
    password: string;
    displayName: string;
    claimCode?: string;
  },
  options: CloudClientOptions = {}
): Promise<{
  success: boolean;
  token?: string;
  user?: CloudUserProfile;
  recoveryKey?: string;
  syncState?: CloudSyncState;
  error?: string;
}> {
  const storage = options.storage !== undefined ? options.storage : getDefaultStorage();
  const fetchFn = options.fetchImpl || fetch;
  const endpointUrl = normalizeEndpoint(options.endpointUrl, storage);

  if (!endpointUrl) {
    return {
      success: false,
      error: 'No Cloud Sync server URL is configured. Planner remains in Local-Only Mode.',
    };
  }

  try {
    const res = await fetchFn(`${endpointUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: params.email.trim().toLowerCase(),
        password: params.password,
        displayName: params.displayName.trim() || 'Me',
        claimCode: params.claimCode?.trim().toUpperCase(),
      }),
    });

    const payload = await res.json().catch(() => ({}));
    if (!res.ok || !payload?.token || !payload?.user) {
      return {
        success: false,
        error: payload?.error || `Registration failed (HTTP ${res.status}).`,
      };
    }

    saveStoredCloudToken(payload.token, storage);
    const nextState = saveStoredCloudSyncState(
      {
        status: 'connected_synced',
        endpointUrl,
        accountId: payload.user.id,
        email: payload.user.email,
        accountUserId: payload.user.id,
        accountEmail: payload.user.email,
        accountDisplayName: payload.user.displayName,
        serverRevision: 0,
        lastSyncError: null,
        entitlement: payload.user.entitlement,
      },
      storage
    );

    return {
      success: true,
      token: payload.token,
      user: payload.user,
      recoveryKey: payload.recoveryKey,
      syncState: nextState,
    };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? `Could not reach Cloud Sync server (${err.message}).`
          : 'Network error during registration.',
    };
  }
}

export async function loginCloudAccount(
  params: {
    email: string;
    password: string;
  },
  options: CloudClientOptions = {}
): Promise<{
  success: boolean;
  token?: string;
  user?: CloudUserProfile;
  serverRevision?: number;
  hasCloudSnapshot?: boolean;
  syncState?: CloudSyncState;
  error?: string;
}> {
  const storage = options.storage !== undefined ? options.storage : getDefaultStorage();
  const fetchFn = options.fetchImpl || fetch;
  const endpointUrl = normalizeEndpoint(options.endpointUrl, storage);

  if (!endpointUrl) {
    return {
      success: false,
      error: 'No Cloud Sync server URL is configured. Planner remains in Local-Only Mode.',
    };
  }

  try {
    const res = await fetchFn(`${endpointUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: params.email.trim().toLowerCase(),
        password: params.password,
      }),
    });

    const payload = await res.json().catch(() => ({}));
    if (!res.ok || !payload?.token || !payload?.user) {
      return {
        success: false,
        error: payload?.error || `Sign-in failed (HTTP ${res.status}).`,
      };
    }

    saveStoredCloudToken(payload.token, storage);
    const nextState = saveStoredCloudSyncState(
      {
        status: 'connected_synced',
        endpointUrl,
        accountId: payload.user.id,
        email: payload.user.email,
        accountUserId: payload.user.id,
        accountEmail: payload.user.email,
        accountDisplayName: payload.user.displayName,
        serverRevision:
          typeof payload.serverRevision === 'number' ? payload.serverRevision : 0,
        lastSyncError: null,
        entitlement: payload.user.entitlement,
      },
      storage
    );

    return {
      success: true,
      token: payload.token,
      user: payload.user,
      serverRevision: payload.serverRevision ?? 0,
      hasCloudSnapshot: Boolean(payload.hasCloudSnapshot),
      syncState: nextState,
    };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? `Could not reach Cloud Sync server (${err.message}).`
          : 'Network error during sign-in.',
    };
  }
}

export async function recoverCloudAccountWithKey(
  params: {
    email: string;
    recoveryKey: string;
    newPassword: string;
  },
  options: CloudClientOptions = {}
): Promise<{
  success: boolean;
  token?: string;
  user?: CloudUserProfile;
  recoveryKey?: string;
  newRecoveryKey?: string;
  syncState?: CloudSyncState;
  error?: string;
}> {
  const storage = options.storage !== undefined ? options.storage : getDefaultStorage();
  const fetchFn = options.fetchImpl || fetch;
  const endpointUrl = normalizeEndpoint(options.endpointUrl, storage);

  if (!endpointUrl) {
    return {
      success: false,
      error: 'No Cloud Sync server URL is configured.',
    };
  }

  try {
    const res = await fetchFn(`${endpointUrl}/api/auth/recover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: params.email.trim().toLowerCase(),
        recoveryKey: params.recoveryKey.trim(),
        newPassword: params.newPassword,
      }),
    });

    const payload = await res.json().catch(() => ({}));
    if (!res.ok || !payload?.token || !payload?.user) {
      return {
        success: false,
        error: payload?.error || `Account recovery failed (HTTP ${res.status}).`,
      };
    }

    saveStoredCloudToken(payload.token, storage);
    const nextState = saveStoredCloudSyncState(
      {
        status: 'connected_synced',
        endpointUrl,
        accountId: payload.user.id,
        email: payload.user.email,
        accountUserId: payload.user.id,
        accountEmail: payload.user.email,
        accountDisplayName: payload.user.displayName,
        serverRevision: payload.serverRevision ?? 0,
        lastSyncError: null,
        entitlement: payload.user.entitlement,
      },
      storage
    );

    return {
      success: true,
      token: payload.token,
      user: payload.user,
      recoveryKey: payload.newRecoveryKey || payload.recoveryKey,
      newRecoveryKey: payload.newRecoveryKey || payload.recoveryKey,
      syncState: nextState,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Network error during account recovery.',
    };
  }
}

export const recoverCloudAccount = recoverCloudAccountWithKey;

export async function logoutCloudAccount(
  options: CloudClientOptions = {}
): Promise<CloudSyncState> {
  const storage = options.storage !== undefined ? options.storage : getDefaultStorage();
  const fetchFn = options.fetchImpl || fetch;
  const endpointUrl = normalizeEndpoint(options.endpointUrl, storage);
  const token = options.token !== undefined ? options.token : getStoredCloudToken(storage);

  if (endpointUrl && token) {
    try {
      await fetchFn(`${endpointUrl}/api/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // ignore network error on logout; always clear local token
    }
  }

  const currentState = getStoredCloudSyncState(storage);
  const currentUserId = currentState.accountUserId || currentState.accountId;
  if (currentUserId) {
    clearStoredCloudAckBase(currentUserId, storage);
  }

  saveStoredCloudToken(null, storage);
  return saveStoredCloudSyncState(
    {
      status: 'local_only',
      endpointUrl,
    },
    storage
  );
}

export async function fetchCloudPlannerSnapshot(
  options: CloudClientOptions = {}
): Promise<{
  success: boolean;
  initialized: boolean;
  serverRevision: number;
  etag?: string;
  updatedAt?: string;
  snapshot?: PlannerBackupData;
  statusCode?: number;
  error?: string;
}> {
  const storage = options.storage !== undefined ? options.storage : getDefaultStorage();
  const fetchFn = options.fetchImpl || fetch;
  const endpointUrl = normalizeEndpoint(options.endpointUrl, storage);
  const token = options.token !== undefined ? options.token : getStoredCloudToken(storage);

  if (!endpointUrl || !token) {
    return {
      success: false,
      initialized: false,
      serverRevision: 0,
      error: 'Not signed in to a Cloud Sync account.',
    };
  }

  try {
    const res = await fetchFn(`${endpointUrl}/api/cloud/planner`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });

    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        initialized: false,
        serverRevision: 0,
        statusCode: res.status,
        error: payload?.error || `Failed to fetch cloud planner (HTTP ${res.status}).`,
      };
    }

    if (!payload.initialized || !payload.snapshot) {
      return {
        success: true,
        initialized: false,
        serverRevision: payload.serverRevision ?? 0,
        statusCode: res.status,
      };
    }

    const validation = validateBackupData(payload.snapshot);
    if (!validation.isValid || !validation.data) {
      return {
        success: false,
        initialized: true,
        serverRevision: payload.serverRevision ?? 0,
        statusCode: res.status,
        error: `Cloud snapshot failed integrity check: ${validation.errors[0] || 'invalid format'}`,
      };
    }

    return {
      success: true,
      initialized: true,
      serverRevision: payload.serverRevision ?? 1,
      etag: payload.etag,
      updatedAt: payload.updatedAt,
      snapshot: validation.data,
      statusCode: res.status,
    };
  } catch (err) {
    return {
      success: false,
      initialized: false,
      serverRevision: 0,
      error: err instanceof Error ? err.message : 'Network failure while fetching cloud data.',
    };
  }
}

export interface CloudSyncResult {
  success: boolean;
  outcome: 'synced' | 'merged' | 'conflict' | 'unauthorized' | 'error';
  serverRevision?: number;
  etag?: string;
  updatedAt?: string;
  snapshot?: PlannerBackupData;
  mergedData?: PlannerBackupData;
  serverSnapshot?: PlannerBackupData;
  conflicts?: ConflictItem[];
  hasRemoteChanges?: boolean;
  syncState: CloudSyncState;
  statusCode?: number;
  error?: string;
}

export async function syncPlannerWithCloud(
  params: {
    localSnapshot: PlannerBackupData;
    baseSnapshot?: PlannerBackupData | null;
    baseRevision?: number;
    migrationMode?: 'merge' | 'use_cloud' | 'overwrite_cloud';
  },
  options: CloudClientOptions = {}
): Promise<CloudSyncResult> {
  const storage = options.storage !== undefined ? options.storage : getDefaultStorage();
  const fetchFn = options.fetchImpl || fetch;
  const currentSyncState = getStoredCloudSyncState(storage);
  const endpointUrl = normalizeEndpoint(options.endpointUrl, storage);
  const token = options.token !== undefined ? options.token : getStoredCloudToken(storage);

  if (!endpointUrl || !token) {
    const localOnlyState: CloudSyncState = {
      status: 'local_only',
      endpointUrl,
    };
    return {
      success: false,
      outcome: 'unauthorized',
      syncState: localOnlyState,
      error: 'Not signed in to a Cloud Sync account.',
    };
  }

  if (currentSyncState.entitlement && !currentSyncState.entitlement.canSync) {
    const blockedState = saveStoredCloudSyncState(
      {
        ...currentSyncState,
        status: 'sync_error',
        lastSyncError: 'Cloud sync entitlement is inactive. Local offline planner remains fully unlocked.',
      },
      storage
    );
    return {
      success: false,
      outcome: 'unauthorized',
      syncState: blockedState,
      error: blockedState.lastSyncError || 'Cloud sync entitlement is inactive.',
    };
  }

  const activeUserId = currentSyncState.accountUserId || currentSyncState.accountId || '';
  const storedAck = activeUserId ? getStoredCloudAckBase(activeUserId, storage) : null;
  const effectiveBaseSnapshot =
    params.baseSnapshot !== undefined ? params.baseSnapshot : storedAck?.snapshot;
  const baseRevision =
    params.baseRevision !== undefined
      ? params.baseRevision
      : storedAck?.serverRevision ?? currentSyncState.serverRevision ?? 0;

  // Handle explicit 'use_cloud' migration mode by pulling from server
  if (params.migrationMode === 'use_cloud') {
    const fetched = await fetchCloudPlannerSnapshot(options);
    if (!fetched.success) {
      const errState = saveStoredCloudSyncState(
        {
          ...currentSyncState,
          endpointUrl,
          status: 'sync_error',
          lastSyncError: fetched.error || 'Could not pull cloud snapshot.',
        },
        storage
      );
      return {
        success: false,
        outcome: fetched.statusCode === 401 || fetched.statusCode === 403 ? 'unauthorized' : 'error',
        syncState: errState,
        statusCode: fetched.statusCode,
        error: fetched.error,
      };
    }

    if (fetched.initialized && fetched.snapshot) {
      const syncedState = saveStoredCloudSyncState(
        {
          ...currentSyncState,
          endpointUrl,
          status: 'connected_synced',
          serverRevision: fetched.serverRevision,
          etag: fetched.etag,
          lastSyncedAt: fetched.updatedAt || new Date().toISOString(),
          lastSyncError: null,
        },
        storage
      );

      if (activeUserId && fetched.serverRevision) {
        saveStoredCloudAckBase(
          activeUserId,
          {
            snapshot: fetched.snapshot,
            serverRevision: fetched.serverRevision,
            etag: fetched.etag || '',
            acknowledgedAt: fetched.updatedAt || new Date().toISOString(),
          },
          storage
        );
      }

      return {
        success: true,
        outcome: 'synced',
        serverRevision: fetched.serverRevision,
        etag: fetched.etag,
        updatedAt: fetched.updatedAt,
        snapshot: fetched.snapshot,
        mergedData: fetched.snapshot,
        hasRemoteChanges: true,
        syncState: syncedState,
      };
    }
  }

  try {
    const res = await fetchFn(`${endpointUrl}/api/cloud/planner`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        baseRevision,
        clientSnapshot: params.localSnapshot,
        baseSnapshot: effectiveBaseSnapshot || undefined,
        migrationMode: params.migrationMode,
      }),
    });

    const payload = await res.json().catch(() => ({}));

    if (res.status === 401 || res.status === 403) {
      const unauthState = saveStoredCloudSyncState(
        {
          ...currentSyncState,
          endpointUrl,
          status: 'sync_error',
          lastSyncError: payload?.error || `Authorization failed (HTTP ${res.status}).`,
        },
        storage
      );
      return {
        success: false,
        outcome: 'unauthorized',
        syncState: unauthState,
        statusCode: res.status,
        error: payload?.error || 'Unauthorized.',
      };
    }

    if (res.status === 409 && payload?.status === 'conflict') {
      const conflictState = saveStoredCloudSyncState(
        {
          ...currentSyncState,
          endpointUrl,
          status: 'conflict_pending',
          serverRevision: payload.serverRevision ?? baseRevision,
          etag: payload.etag,
          lastSyncError: 'Sync conflict detected — choose which version to keep.',
        },
        storage
      );
      return {
        success: true,
        outcome: 'conflict',
        serverRevision: payload.serverRevision,
        etag: payload.etag,
        snapshot: payload.mergedData,
        mergedData: payload.mergedData,
        serverSnapshot: payload.serverSnapshot,
        conflicts: Array.isArray(payload.conflicts) ? payload.conflicts : [],
        hasRemoteChanges: true,
        syncState: conflictState,
        statusCode: 409,
      };
    }

    if (!res.ok) {
      const errState = saveStoredCloudSyncState(
        {
          ...currentSyncState,
          endpointUrl,
          status: 'sync_error',
          lastSyncError: payload?.error || `Cloud sync failed (HTTP ${res.status}).`,
        },
        storage
      );
      return {
        success: false,
        outcome: 'error',
        syncState: errState,
        statusCode: res.status,
        error: payload?.error || `Cloud sync failed (HTTP ${res.status}).`,
      };
    }

    const syncedState = saveStoredCloudSyncState(
      {
        ...currentSyncState,
        endpointUrl,
        status: 'connected_synced',
        serverRevision: payload.serverRevision,
        etag: payload.etag,
        lastSyncedAt: payload.updatedAt || new Date().toISOString(),
        lastSyncError: null,
      },
      storage
    );

    const finalSnapshot = payload.snapshot || params.localSnapshot;

    if (activeUserId && payload.serverRevision) {
      saveStoredCloudAckBase(
        activeUserId,
        {
          snapshot: finalSnapshot,
          serverRevision: payload.serverRevision,
          etag: payload.etag || '',
          acknowledgedAt: payload.updatedAt || new Date().toISOString(),
        },
        storage
      );
    }

    return {
      success: true,
      outcome: payload.status === 'merged' ? 'merged' : 'synced',
      serverRevision: payload.serverRevision,
      etag: payload.etag,
      updatedAt: payload.updatedAt,
      snapshot: finalSnapshot,
      mergedData: finalSnapshot,
      hasRemoteChanges: Boolean(payload.hasRemoteChanges),
      syncState: syncedState,
      statusCode: res.status,
    };
  } catch (err) {
    const errMsg =
      err instanceof Error
        ? `Sync interrupted (${err.message}). Local planner data is safely preserved.`
        : 'Sync interrupted due to network error. Local planner data is safely preserved.';
    const errState = saveStoredCloudSyncState(
      {
        ...currentSyncState,
        endpointUrl,
        status: 'sync_error',
        lastSyncError: errMsg,
      },
      storage
    );
    return {
      success: false,
      outcome: 'error',
      syncState: errState,
      error: errMsg,
    };
  }
}

export const syncWithCloud = syncPlannerWithCloud;

export async function exportCloudAccountBackup(
  options: CloudClientOptions = {}
): Promise<{
  success: boolean;
  data?: PlannerBackupData;
  backup?: PlannerBackupData;
  statusCode?: number;
  error?: string;
}> {
  const storage = options.storage !== undefined ? options.storage : getDefaultStorage();
  const fetchFn = options.fetchImpl || fetch;
  const endpointUrl = normalizeEndpoint(options.endpointUrl, storage);
  const token = options.token !== undefined ? options.token : getStoredCloudToken(storage);

  if (!endpointUrl || !token) {
    return {
      success: false,
      error: 'Not signed in to a Cloud Sync account.',
    };
  }

  try {
    const res = await fetchFn(`${endpointUrl}/api/cloud/export`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        statusCode: res.status,
        error: payload?.error || `Cloud export failed (HTTP ${res.status}).`,
      };
    }

    const validation = validateBackupData(payload);
    if (!validation.isValid || !validation.data) {
      return {
        success: false,
        statusCode: res.status,
        error: `Exported cloud payload failed schema validation: ${validation.errors[0] || 'invalid'}`,
      };
    }

    return {
      success: true,
      data: validation.data,
      backup: validation.data,
      statusCode: res.status,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Network error during cloud export.',
    };
  }
}

export const exportCloudData = exportCloudAccountBackup;

export async function deleteCloudAccount(
  options: CloudClientOptions = {}
): Promise<{
  success: boolean;
  syncState: CloudSyncState;
  error?: string;
}> {
  const storage = options.storage !== undefined ? options.storage : getDefaultStorage();
  const fetchFn = options.fetchImpl || fetch;
  const endpointUrl = normalizeEndpoint(options.endpointUrl, storage);
  const token = options.token !== undefined ? options.token : getStoredCloudToken(storage);

  if (!endpointUrl || !token) {
    return {
      success: false,
      syncState: getStoredCloudSyncState(storage),
      error: 'Not signed in to a Cloud Sync account.',
    };
  }

  try {
    const res = await fetchFn(`${endpointUrl}/api/auth/account`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        syncState: getStoredCloudSyncState(storage),
        error: payload?.error || `Account deletion failed (HTTP ${res.status}).`,
      };
    }

    saveStoredCloudToken(null, storage);
    const resetState = saveStoredCloudSyncState(
      {
        status: 'local_only',
        endpointUrl,
      },
      storage
    );
    return {
      success: true,
      syncState: resetState,
    };
  } catch (err) {
    return {
      success: false,
      syncState: getStoredCloudSyncState(storage),
      error: err instanceof Error ? err.message : 'Network error during account deletion.',
    };
  }
}

export async function claimCloudPurchaseCode(
  claimCode: string,
  options: CloudClientOptions = {}
): Promise<{
  success: boolean;
  entitlement?: CloudEntitlement;
  statusCode?: number;
  error?: string;
  message?: string;
}> {
  const storage = options.storage !== undefined ? options.storage : getDefaultStorage();
  const fetchFn = options.fetchImpl || fetch;
  const endpointUrl = normalizeEndpoint(options.endpointUrl, storage);
  const token = options.token !== undefined ? options.token : getStoredCloudToken(storage);

  if (!endpointUrl || !token) {
    return {
      success: false,
      error: 'Must be signed in to an online account to claim a purchase code.',
    };
  }

  try {
    const res = await fetchFn(`${endpointUrl}/api/auth/claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ claimCode }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        statusCode: res.status,
        error: payload?.error || 'Claiming purchase code failed.',
      };
    }

    if (payload.entitlement) {
      const currentState = getStoredCloudSyncState(storage);
      saveStoredCloudSyncState(
        {
          ...currentState,
          entitlement: payload.entitlement,
        },
        storage
      );
    }

    return {
      success: true,
      entitlement: payload.entitlement,
      message: payload.message || 'Lifetime sync access successfully activated.',
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Network error during code claim.',
    };
  }
}

