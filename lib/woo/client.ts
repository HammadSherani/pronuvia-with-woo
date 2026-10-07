import "server-only";

// Server-only WooCommerce REST client. Auth uses the consumer key/secret over
// HTTPS (Basic auth) — the keys must never reach the browser.

export class WooError extends Error {
  constructor(
    message: string,
    public status: number,        // HTTP status, 0 = network error / timeout / config
    public code: string,          // Woo error code, e.g. "woocommerce_rest_authentication_error"
  ) {
    super(message);
    this.name = "WooError";
  }
}

type Query = Record<string, string | number | boolean | undefined>;

export type WooRequestOptions = {
  method?:    "GET" | "POST" | "PUT" | "DELETE";
  query?:     Query;
  body?:      unknown;
  timeoutMs?: number;
  retries?:   number;             // only applied to GET requests
  // Opt into the Next.js data cache (GET only). Omit for always-fresh data.
  cacheFor?:  { revalidate: number; tags: string[] };
};

export type WooResponse<T> = {
  data:    T;
  headers: Headers;
};

const DEFAULT_TIMEOUT_MS  = 15_000;
const DEFAULT_GET_RETRIES = 2;

function getConfig() {
  const url    = process.env.WOO_URL;
  const key    = process.env.WOO_CONSUMER_KEY;
  const secret = process.env.WOO_CONSUMER_SECRET;
  if (!url || !key || !secret) {
    throw new WooError("WooCommerce is not configured on this server.", 0, "woo_not_configured");
  }

  const base = new URL(url);
  const isLocal = base.hostname === "localhost" || base.hostname === "127.0.0.1";
  if (base.protocol !== "https:" && !isLocal) {
    // Basic auth over plain HTTP would leak the keys
    throw new WooError("WOO_URL must use https.", 0, "woo_insecure_url");
  }

  return {
    baseUrl: base.origin + base.pathname.replace(/\/$/, ""),
    auth:    "Basic " + Buffer.from(`${key}:${secret}`).toString("base64"),
  };
}

function buildUrl(baseUrl: string, path: string, query?: Query) {
  const url = new URL(`${baseUrl}/wp-json/${path.replace(/^\//, "")}`);
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }
  return url;
}

async function parseError(res: Response): Promise<WooError> {
  const text = await res.text().catch(() => "");
  try {
    const json = JSON.parse(text) as { code?: string; message?: string };
    if (json.message) {
      return new WooError(json.message, res.status, json.code ?? "woo_error");
    }
  } catch {
    // Not JSON — usually a hosting/firewall HTML error page
  }
  return new WooError(`WooCommerce responded with HTTP ${res.status}.`, res.status, "woo_http_error");
}

function isRetryable(err: WooError) {
  return err.status === 0 || err.status === 429 || err.status >= 500;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function wooFetch<T>(
  path: string,
  opts: WooRequestOptions = {},
): Promise<WooResponse<T>> {
  const { baseUrl, auth } = getConfig();
  const method    = opts.method ?? "GET";
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries   = method === "GET" ? (opts.retries ?? DEFAULT_GET_RETRIES) : 0;
  const url       = buildUrl(baseUrl, path, opts.query);

  let lastError: WooError | undefined;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(500 * attempt);

    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: {
          Authorization: auth,
          Accept:        "application/json",
          ...(opts.body !== undefined && { "Content-Type": "application/json" }),
        },
        body:   opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: AbortSignal.timeout(timeoutMs),
        ...(opts.cacheFor && method === "GET"
          ? { next: opts.cacheFor }
          : { cache: "no-store" as const }),
      });
    } catch (e) {
      const timedOut = e instanceof Error && e.name === "TimeoutError";
      lastError = new WooError(
        timedOut
          ? `WooCommerce did not respond within ${timeoutMs / 1000}s.`
          : "Could not reach WooCommerce.",
        0,
        timedOut ? "woo_timeout" : "woo_network_error",
      );
      continue;
    }

    if (!res.ok) {
      lastError = await parseError(res);
      if (isRetryable(lastError)) continue;
      throw lastError;
    }

    const data = (await res.json()) as T;
    return { data, headers: res.headers };
  }

  throw lastError!;
}
