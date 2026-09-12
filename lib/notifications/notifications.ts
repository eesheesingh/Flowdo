import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { DerivedNotification } from "./derive";

type Client = SupabaseClient<Database, "flowdo">;

export async function listReadKeys(supabase: Client) {
  const { data, error } = await supabase.from("notifications").select("dedupe_key").not("dedupe_key", "is", null);
  if (error) return { data: null, error: "Couldn't load notifications. Please try again." };
  return { data: (data ?? []).map((r) => r.dedupe_key as string), error: null };
}

export async function markRead(supabase: Client, userId: string, items: DerivedNotification[]) {
  if (items.length === 0) return { error: null };
  // Plain insert, not upsert: the unique index backing dismissals
  // (migration 0010) is a *partial* index (`where dedupe_key is not null`),
  // and Postgres can't use a partial index as an ON CONFLICT arbiter unless
  // the statement's ON CONFLICT clause repeats that exact predicate -
  // something PostgREST's upsert(onConflict: ...) has no way to express, so
  // it always fails with 42P10. Inserting and swallowing the resulting
  // 23505 (unique_violation) gets the same idempotent-dismiss behavior by
  // relying on the DB constraint directly instead.
  for (const n of items) {
    const { error } = await supabase.from("notifications").insert({
      user_id: userId,
      dedupe_key: n.key,
      type: n.type,
      title: n.title,
      message: n.message,
      task_id: n.taskId,
      is_read: true,
    });
    if (error && error.code !== "23505") {
      return { error: "Couldn't update notifications. Please try again." };
    }
  }
  return { error: null };
}

export async function markAllRead(supabase: Client, userId: string, items: DerivedNotification[]) {
  return markRead(supabase, userId, items);
}
