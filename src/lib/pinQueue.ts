import type { PendingPin, TreePin } from "./types";
import { supabase } from "./supabase";

const KEY_PREFIX = "zellin:pending-pins:";

export function queueKey(projectId: string) {
  return `${KEY_PREFIX}${projectId}`;
}

export function readQueue(projectId: string): PendingPin[] {
  try {
    const raw = localStorage.getItem(queueKey(projectId));
    return raw ? (JSON.parse(raw) as PendingPin[]) : [];
  } catch {
    return [];
  }
}

export function writeQueue(projectId: string, pins: PendingPin[]) {
  localStorage.setItem(queueKey(projectId), JSON.stringify(pins));
}

export function enqueuePin(projectId: string, pin: PendingPin) {
  const q = readQueue(projectId);
  q.push(pin);
  writeQueue(projectId, q);
}

export function removePending(projectId: string, clientId: string) {
  const q = readQueue(projectId).filter((p) => p.client_id !== clientId);
  writeQueue(projectId, q);
}

export async function flushQueue(projectId: string): Promise<TreePin[]> {
  const q = readQueue(projectId);
  if (q.length === 0) return [];
  const synced: TreePin[] = [];
  for (const pending of q) {
    const { client_id: _client, pending: _pending, ...row } = pending;
    void _client;
    void _pending;
    const { data, error } = await supabase
      .from("tree_pins")
      .insert(row)
      .select()
      .single();
    if (!error && data) {
      synced.push(data as TreePin);
      removePending(projectId, pending.client_id);
    } else {
      // Stop on first error — likely offline again.
      break;
    }
  }
  return synced;
}
