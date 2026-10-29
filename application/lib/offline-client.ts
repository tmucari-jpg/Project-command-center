"use client";

const DB_NAME = "pcc-offline";
const DB_VERSION = 1;
const META_STORE = "meta";
const SNAPSHOT_STORE = "snapshot";
const QUEUE_STORE = "queue";

export type OfflineRecord = { id: string; [key: string]: unknown };
export type OfflineProject = { id: string; title: string; status?: string | null; [key: string]: unknown };
export type OfflineDeliverable = { id: string; title: string; project_id?: string | null; status?: string | null; [key: string]: unknown };
export type OfflineAction = {
  id: string;
  title: string;
  project_id?: string | null;
  deliverable_id?: string | null;
  status: string;
  priority?: string | null;
  due_at?: string | null;
  is_next_action?: boolean | null;
  [key: string]: unknown;
};

export type OfflineSnapshot = {
  generatedAt: string;
  isAdmin: boolean;
  projects: OfflineProject[];
  objectives: OfflineRecord[];
  deliverables: OfflineDeliverable[];
  actions: OfflineAction[];
  blockers: OfflineRecord[];
  metrics: OfflineRecord[];
  evidence: OfflineRecord[];
  ideas: OfflineRecord[];
  factoryCases: OfflineRecord[];
  dependencies: OfflineRecord[];
  risks: OfflineRecord[];
  decisions: OfflineRecord[];
  strategyPlans: OfflineRecord[];
  commercialProfiles: OfflineRecord[];
  financialEntries: OfflineRecord[];
  commercialLeads: OfflineRecord[];
};

export type OfflineQueueType =
  | "create_action"
  | "create_idea"
  | "create_evidence"
  | "create_blocker"
  | "create_factory_intake"
  | "update_action_status"
  | "update_project_next_action";

export type OfflineQueueItem = {
  id: string;
  type: OfflineQueueType;
  payload: Record<string, unknown>;
  createdAt: string;
  status: "pending" | "failed";
  error?: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE);
      if (!db.objectStoreNames.contains(SNAPSHOT_STORE)) db.createObjectStore(SNAPSHOT_STORE);
      if (!db.objectStoreNames.contains(QUEUE_STORE)) db.createObjectStore(QUEUE_STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function setOfflineMeta(key: string, value: unknown) {
  const db = await openDb();
  const tx = db.transaction(META_STORE, "readwrite");
  tx.objectStore(META_STORE).put(value, key);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getOfflineMeta<T = unknown>(key: string): Promise<T | undefined> {
  const db = await openDb();
  const tx = db.transaction(META_STORE, "readonly");
  const value = await requestResult(tx.objectStore(META_STORE).get(key));
  db.close();
  return value as T | undefined;
}

export async function saveOfflineSnapshot(snapshot: OfflineSnapshot) {
  const db = await openDb();
  const tx = db.transaction(SNAPSHOT_STORE, "readwrite");
  tx.objectStore(SNAPSHOT_STORE).put(snapshot, "workspace");
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  await setOfflineMeta("offlineEnabled", true);
  await setOfflineMeta("lastSnapshotAt", snapshot.generatedAt);
}

export async function getOfflineSnapshot(): Promise<OfflineSnapshot | undefined> {
  const db = await openDb();
  const tx = db.transaction(SNAPSHOT_STORE, "readonly");
  const value = await requestResult(tx.objectStore(SNAPSHOT_STORE).get("workspace"));
  db.close();
  return value as OfflineSnapshot | undefined;
}

export async function queueOfflineItem(type: OfflineQueueType, payload: Record<string, unknown>) {
  const db = await openDb();
  const item: OfflineQueueItem = {
    id: crypto.randomUUID(),
    type,
    payload,
    createdAt: new Date().toISOString(),
    status: "pending",
  };
  const tx = db.transaction(QUEUE_STORE, "readwrite");
  tx.objectStore(QUEUE_STORE).put(item);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  return item;
}

export async function getOfflineQueue(): Promise<OfflineQueueItem[]> {
  const db = await openDb();
  const tx = db.transaction(QUEUE_STORE, "readonly");
  const items = await requestResult(tx.objectStore(QUEUE_STORE).getAll());
  db.close();
  return (items as OfflineQueueItem[]).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

async function removeQueueItems(ids: string[]) {
  if (!ids.length) return;
  const db = await openDb();
  const tx = db.transaction(QUEUE_STORE, "readwrite");
  const store = tx.objectStore(QUEUE_STORE);
  ids.forEach((id) => store.delete(id));
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function markQueueFailures(results: Array<{ id: string; ok: boolean; error?: string }>) {
  const failures = results.filter((result) => !result.ok);
  if (!failures.length) return;
  const db = await openDb();
  const tx = db.transaction(QUEUE_STORE, "readwrite");
  const store = tx.objectStore(QUEUE_STORE);
  for (const failure of failures) {
    const item = (await requestResult(store.get(failure.id))) as OfflineQueueItem | undefined;
    if (item) store.put({ ...item, status: "failed", error: failure.error ?? "Falha de sincronização" });
  }
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function refreshOfflineSnapshot() {
  if (typeof navigator !== "undefined" && !navigator.onLine) return false;
  const response = await fetch("/api/offline/bootstrap", { credentials: "include", cache: "no-store" });
  if (!response.ok) return false;
  const snapshot = (await response.json()) as OfflineSnapshot;
  await saveOfflineSnapshot(snapshot);
  return true;
}

export async function syncOfflineQueue() {
  if (typeof navigator !== "undefined" && !navigator.onLine) return { synced: 0, pending: (await getOfflineQueue()).length };

  const queue = await getOfflineQueue();
  if (!queue.length) return { synced: 0, pending: 0 };

  const response = await fetch("/api/offline/sync", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ items: queue }),
  });

  if (!response.ok) return { synced: 0, pending: queue.length };

  const body = (await response.json()) as { results: Array<{ id: string; ok: boolean; error?: string }> };
  const successful = body.results.filter((result) => result.ok).map((result) => result.id);
  await removeQueueItems(successful);
  await markQueueFailures(body.results);
  await refreshOfflineSnapshot().catch(() => false);
  const pending = (await getOfflineQueue()).length;
  return { synced: successful.length, pending };
}

const OFFLINE_ROUTE_CACHE = "project-command-center-v6";
export async function refreshOfflineRouteCache() {
  // Protected server-rendered pages are intentionally not persisted.
  // Offline mode is driven by the filtered IndexedDB snapshot and static offline shell.
  return typeof window !== "undefined" && "caches" in window;
}

export async function clearOfflineData() {
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });

  if (typeof window !== "undefined" && "caches" in window) {
    await caches.delete(OFFLINE_ROUTE_CACHE).catch(() => false);
  }
}
