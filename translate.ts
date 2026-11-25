/**
 * Server-side translation.
 *
 * The browser used to call translate.googleapis.com with client=gtx — an
 * undocumented endpoint with no support contract, which also meant every
 * student's device shipped the class's questions to Google, and thirty devices
 * hammered it independently.
 *
 * This replaces that with an explicitly configured provider, called once by the
 * server and cached. With nothing configured, translation is simply off and the
 * text is shown exactly as it was written — the private, dependency-free
 * default.
 *
 * The expected provider is the LibreTranslate API (self-hostable), or anything
 * exposing the same contract:
 *
 *   POST {QA_TRANSLATE_URL}/translate
 *   { "q": "...", "source": "auto", "target": "pt", "format": "text" }
 *   -> { "translatedText": "..." }
 */

const PROVIDER_URL = (process.env.QA_TRANSLATE_URL ?? "").trim().replace(/\/+$/, "");
const API_KEY = (process.env.QA_TRANSLATE_API_KEY ?? "").trim();
const TIMEOUT_MS = 8000;
const MAX_CACHE_ENTRIES = 5000;

/** Keyed by `${locale}::${text}`; bounded so a long session cannot leak memory. */
const cache = new Map<string, string>();

export function isTranslationEnabled() {
  return PROVIDER_URL.length > 0;
}

export function translationProviderHost() {
  if (!PROVIDER_URL) {
    return null;
  }
  try {
    return new URL(PROVIDER_URL).host;
  } catch {
    return PROVIDER_URL;
  }
}

function cacheGet(key: string) {
  const hit = cache.get(key);
  if (hit !== undefined) {
    // Refresh recency so the eviction below drops genuinely cold entries.
    cache.delete(key);
    cache.set(key, hit);
  }
  return hit;
}

function cacheSet(key: string, value: string) {
  cache.set(key, value);
  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

/**
 * Translates one string. Returns the original text on any failure, so a
 * provider being down degrades to untranslated content rather than an error.
 */
export async function translateText(text: string, targetLocale: string): Promise<string> {
  if (!isTranslationEnabled() || !text || !text.trim()) {
    return text;
  }

  const target = (targetLocale || "en").trim();
  const key = `${target}::${text}`;

  const cached = cacheGet(key);
  if (cached !== undefined) {
    return cached;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${PROVIDER_URL}/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: text,
        source: "auto",
        target,
        format: "text",
        ...(API_KEY ? { api_key: API_KEY } : {})
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Translation provider responded ${response.status}`);
    }

    const payload = await response.json() as { translatedText?: unknown };
    const translated = typeof payload.translatedText === "string" ? payload.translatedText : null;

    if (!translated) {
      throw new Error("Translation provider returned no translatedText");
    }

    cacheSet(key, translated);
    return translated;
  } catch (error) {
    console.warn(`[translate] Falling back to the original text: ${(error as Error).message}`);
    return text;
  } finally {
    clearTimeout(timer);
  }
}

/** Translates a batch, preserving order. Failures fall back per item. */
export async function translateBatch(texts: string[], targetLocale: string): Promise<string[]> {
  if (!isTranslationEnabled()) {
    return texts;
  }
  return Promise.all(texts.map(text => translateText(text, targetLocale)));
}
