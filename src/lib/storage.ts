import { readFile, writeFile } from "node:fs/promises";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";

// All media lives in one private bucket; the app hands out short-lived signed URLs.
const bucket = () => supabaseAdmin().storage.from(env().SUPABASE_STORAGE_BUCKET);

export const paths = {
  recording: (packId: string, sourceId: string, ext: string) => `packs/${packId}/recordings/${sourceId}.${ext}`,
  clip: (packId: string, n: number) => `packs/${packId}/clips/clip-${n}.mp4`,
  poster: (packId: string, n: number) => `packs/${packId}/clips/clip-${n}.jpg`,
  draft: (packId: string, spec: string) => `packs/${packId}/drafts/${spec}.mp4`,
  draftStill: (packId: string, still: string) => `packs/${packId}/drafts/still-${still}.png`,
};

export async function createUploadUrl(path: string) {
  const { data, error } = await bucket().createSignedUploadUrl(path, { upsert: true });
  if (error) throw error;
  return data;
}

export async function downloadTo(path: string, file: string): Promise<void> {
  const { data, error } = await bucket().download(path);
  if (error) throw error;
  await writeFile(file, Buffer.from(await data.arrayBuffer()));
}

export async function uploadFile(path: string, file: string, contentType: string): Promise<void> {
  const { error } = await bucket().upload(path, await readFile(file), { contentType, upsert: true });
  if (error) throw error;
}

export async function signedUrl(path: string, seconds = 3600): Promise<string> {
  const { data, error } = await bucket().createSignedUrl(path, seconds);
  if (error) throw error;
  return data.signedUrl;
}

export async function signedUrls(list: string[], seconds = 3600): Promise<Record<string, string>> {
  if (list.length === 0) return {};
  const { data, error } = await bucket().createSignedUrls(list, seconds);
  if (error) throw error;
  return Object.fromEntries(data.flatMap((d) => (d.path && d.signedUrl ? [[d.path, d.signedUrl]] : [])));
}
