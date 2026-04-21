/**
 * Thin wrapper over Upstash Redis REST API.
 *
 * Uses only native fetch — no @upstash/redis package required.
 * REST pipeline endpoint: POST / with body as array of Redis command args.
 * Docs: https://upstash.com/docs/redis/features/restapi
 *
 * Graceful degradation: if UPSTASH_REDIS_REST_URL is not set,
 * all functions return null/void silently without throwing.
 */

function getConfig(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

/**
 * Execute a single Redis command via the Upstash REST API.
 * Body format: ["COMMAND", "arg1", "arg2", ...]
 */
async function redisCommand(command: (string | number)[]): Promise<unknown> {
  const config = getConfig();
  if (!config) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);

  try {
    const res = await fetch(config.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(command),
      signal: controller.signal
    });

    if (!res.ok) {
      console.warn(`[redis] HTTP ${res.status} for command ${command[0]}`);
      return null;
    }

    const json = (await res.json()) as { result: unknown; error?: string };
    if (json.error) {
      console.warn("[redis] command error:", json.error);
      return null;
    }
    return json.result ?? null;
  } catch (err) {
    if ((err as Error)?.name === "AbortError") {
      console.warn("[redis] request timed out (command:", command[0], ")");
    } else {
      console.warn("[redis] request failed:", err);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * GET a value by key. Returns null if key does not exist or Redis is unavailable.
 */
export async function cacheGet(key: string): Promise<string | null> {
  const result = await redisCommand(["GET", key]);
  if (result === null || result === undefined) return null;
  return String(result);
}

/**
 * SET a value by key, optionally with a TTL in seconds (uses SETEX).
 * Silently no-ops if Redis is unavailable.
 */
export async function cacheSet(
  key: string,
  value: string,
  ttlSeconds?: number
): Promise<void> {
  if (ttlSeconds !== undefined && ttlSeconds > 0) {
    await redisCommand(["SETEX", key, ttlSeconds, value]);
  } else {
    await redisCommand(["SET", key, value]);
  }
}

/**
 * SET key only if absent (NX) with EX ttl.
 * Returns:
 *  - true  -> key was set
 *  - false -> key already exists
 *  - null  -> Redis unavailable/error
 */
export async function cacheSetIfAbsent(
  key: string,
  value: string,
  ttlSeconds: number
): Promise<boolean | null> {
  const result = await redisCommand(["SET", key, value, "EX", ttlSeconds, "NX"]);
  if (result === null || result === undefined) return null;
  return String(result).toUpperCase() === "OK";
}

/**
 * DEL a key from the cache.
 * Silently no-ops if Redis is unavailable.
 */
export async function cacheDel(key: string): Promise<void> {
  await redisCommand(["DEL", key]);
}
