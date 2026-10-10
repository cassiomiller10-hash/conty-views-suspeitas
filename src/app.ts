import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { classify, hourlyView } from "./classificador.ts";
import { CRITERIA_VERSION, FAMILIES, LIMITS, RULE } from "./criterios.ts";
import { InputError, parseClassifyRequest } from "./serie.ts";

/** API sem estado: recebe a série, devolve a classificação. Não guarda nada. */
export function createApp() {
  const app = new Hono();

  app.onError((error, c) => {
    if (error instanceof InputError) return c.json({ error: "invalid_series", field: error.field, message: error.message }, 422);
    console.error(error);
    return c.json({ error: "internal_error", message: "Erro inesperado." }, 500);
  });

  app.get("/health", (c) => c.json({ ok: true }));

  /** O critério em vigor: regra, famílias e limites. */
  app.get("/criteria", (c) => c.json({ criteria_version: CRITERIA_VERSION, rule: RULE, families: FAMILIES, limits: LIMITS }));

  // 30 dias de leituras cabem com folga em 1 MB.
  app.post(
    "/classify",
    bodyLimit({ maxSize: 1024 * 1024, onError: (c) => c.json({ error: "body_too_large", message: "O corpo passa de 1 MB." }, 413) }),
    async (c) => {
      let body: unknown;
      try {
        body = await c.req.json();
      } catch {
        return c.json({ error: "invalid_json", message: "O corpo precisa ser JSON." }, 400);
      }
      const request = parseClassifyRequest(body);
      const result = classify(request.series, request.audienceTimezone);
      // ?hourly=true: views de cada hora para exibição; horas de buraco vêm marcadas como estimadas.
      const hourly = c.req.query("hourly");
      if (hourly === "true" || hourly === "1") return c.json({ ...result, hourly: hourlyView(request.series, request.audienceTimezone) });
      return c.json(result);
    },
  );

  return app;
}
