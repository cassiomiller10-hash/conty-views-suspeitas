import { createApp } from "../src/app.ts";

const app = createApp();

/** POST no app em memória; `raw` manda o corpo como está, sem JSON.stringify. */
export async function post(path: string, body: unknown, raw = false) {
  const res = await app.request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: raw ? (body as string) : JSON.stringify(body),
  });
  // biome-ignore lint: corpo genérico nos testes
  return { status: res.status, body: (await res.json()) as any };
}

export async function get(path: string) {
  const res = await app.request(path);
  // biome-ignore lint: corpo genérico nos testes
  return { status: res.status, body: (await res.json()) as any };
}
