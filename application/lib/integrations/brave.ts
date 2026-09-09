import { z } from "zod";
import { requireBraveKey } from "@/lib/env";

const braveResultSchema = z
  .object({
    title: z.string().max(1000),
    url: z
      .string()
      .url()
      .max(4000)
      .refine((value) => {
        const protocol = new URL(value).protocol;
        return protocol === "http:" || protocol === "https:";
      }),
    description: z.string().max(5000).optional().nullable(),
    age: z.string().max(200).optional().nullable(),
    page_age: z.string().max(200).optional().nullable(),
  })
  .passthrough();

const braveResponseSchema = z
  .object({
    web: z
      .object({
        results: z.array(braveResultSchema).max(50),
      })
      .optional(),
  })
  .passthrough();

export type BraveResult = {
  title: string;
  url: string;
  description: string | null;
  age: string | null;
};

export class BraveSearchError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "TIMEOUT"
      | "RATE_LIMITED"
      | "AUTHENTICATION_FAILED"
      | "INVALID_RESPONSE"
      | "INTEGRATION_UNAVAILABLE",
  ) {
    super(message);
    this.name = "BraveSearchError";
  }
}

export async function searchBrave(query: string, signal: AbortSignal): Promise<BraveResult[]> {
  const key = requireBraveKey();
  const params = new URLSearchParams({
    q: query,
    count: "10",
    search_lang: "pt",
    safesearch: "moderate",
  });

  let response: Response;
  try {
    response = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": key,
      },
      signal,
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new BraveSearchError("A pesquisa excedeu o tempo limite.", "TIMEOUT");
    }
    throw new BraveSearchError("Brave Search está indisponível.", "INTEGRATION_UNAVAILABLE");
  }

  if (response.status === 401 || response.status === 403) {
    throw new BraveSearchError("Falha de autenticação no Brave Search.", "AUTHENTICATION_FAILED");
  }
  if (response.status === 429) {
    throw new BraveSearchError("Limite do Brave Search atingido.", "RATE_LIMITED");
  }
  if (!response.ok) {
    throw new BraveSearchError(
      `Brave Search respondeu com HTTP ${response.status}.`,
      "INTEGRATION_UNAVAILABLE",
    );
  }

  const json: unknown = await response.json();
  const parsed = braveResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new BraveSearchError("Resposta inválida do Brave Search.", "INVALID_RESPONSE");
  }

  return (parsed.data.web?.results ?? []).map((result) => ({
    title: result.title,
    url: result.url,
    description: result.description ?? null,
    age: result.age ?? result.page_age ?? null,
  }));
}
