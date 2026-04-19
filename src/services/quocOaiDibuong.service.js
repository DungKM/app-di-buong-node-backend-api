const axios = require("axios");
const https = require("https");

const DEFAULT_BASE_URL = "https://bvdkquocoai.hosoyte.com/sync/dibuong";
const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_CACHE_TTL_MS = 30000;
const DEFAULT_MAX_CONCURRENCY = 6;

const responseCache = new Map();

function getNumericEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function getBaseUrl() {
  const raw = String(process.env.QUOCOAI_DIBUONG_BASE_URL || DEFAULT_BASE_URL).trim();
  return raw.replace(/\/+$/, "");
}

function getTimeoutMs() {
  return getNumericEnv("QUOCOAI_DIBUONG_TIMEOUT_MS", DEFAULT_TIMEOUT_MS);
}

function getCacheTtlMs() {
  return getNumericEnv("QUOCOAI_DIBUONG_CACHE_TTL_MS", DEFAULT_CACHE_TTL_MS);
}

function getMaxConcurrency() {
  return getNumericEnv("QUOCOAI_DIBUONG_MAX_CONCURRENCY", DEFAULT_MAX_CONCURRENCY);
}

function shouldRejectUnauthorized() {
  const raw = String(process.env.QUOCOAI_DIBUONG_REJECT_UNAUTHORIZED || "true")
    .trim()
    .toLowerCase();

  return !["false", "0", "no", "off"].includes(raw);
}

function buildCacheKey(pathname, params = {}) {
  const normalizedParams = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .sort(([left], [right]) => left.localeCompare(right));

  return JSON.stringify([pathname, normalizedParams]);
}

function readCache(cacheKey) {
  const cached = responseCache.get(cacheKey);
  if (!cached) return null;

  if (cached.expiresAt <= Date.now()) {
    responseCache.delete(cacheKey);
    return null;
  }

  return cached.value;
}

function unwrapResponseData(data) {
  if (data && typeof data === "object" && "data" in data && data.data !== undefined) {
    return data.data;
  }

  return data;
}

function buildUpstreamError(error, pathname, params) {
  if (error?.response) {
    const detail =
      typeof error.response.data === "string"
        ? error.response.data
        : error.response.data?.message || error.response.statusText || "Upstream request failed";

    return new Error(
      `Upstream ${pathname} failed (${error.response.status}) for ${JSON.stringify(params)}: ${detail}`
    );
  }

  if (error?.request) {
    const code = error?.code ? ` (${error.code})` : "";
    const message = error?.message ? `: ${error.message}` : "";
    return new Error(
      `Upstream ${pathname} request failed${code} for ${JSON.stringify(params)}${message}`
    );
  }

  return new Error(error?.message || `Upstream ${pathname} failed`);
}

async function cachedGet(pathname, params = {}, options = {}) {
  const ttlMs = options.ttlMs ?? getCacheTtlMs();
  const cacheKey = buildCacheKey(pathname, params);
  const cached = readCache(cacheKey);
  if (cached !== null) {
    return cached;
  }

  try {
    const response = await axios.get(`${getBaseUrl()}/${pathname.replace(/^\/+/, "")}`, {
      params,
      timeout: getTimeoutMs(),
      httpsAgent: new https.Agent({
        rejectUnauthorized: shouldRejectUnauthorized(),
      }),
      headers: {
        Accept: "application/json",
      },
    });

    const value = unwrapResponseData(response.data);
    responseCache.set(cacheKey, {
      value,
      expiresAt: Date.now() + ttlMs,
    });

    return value;
  } catch (error) {
    throw buildUpstreamError(error, pathname, params);
  }
}

async function mapWithConcurrency(items, worker, limit = getMaxConcurrency()) {
  if (!Array.isArray(items) || items.length === 0) {
    return { results: [], errors: [] };
  }

  const results = new Array(items.length);
  const errors = [];
  let nextIndex = 0;

  const workerCount = Math.max(1, Math.min(limit, items.length));

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        const currentIndex = nextIndex;
        nextIndex += 1;

        if (currentIndex >= items.length) {
          return;
        }

        const item = items[currentIndex];

        try {
          results[currentIndex] = await worker(item, currentIndex);
        } catch (error) {
          results[currentIndex] = null;
          errors.push({
            index: currentIndex,
            input: item,
            message: error?.message || "Unknown upstream error",
          });
        }
      }
    })
  );

  return { results, errors };
}

async function getBuongPhong(idKhoa) {
  return cachedGet("buongphong", { IdKhoa: idKhoa });
}

async function getDsLanKham(idBenhAn) {
  const data = await cachedGet("dslankham", { IdBenhAn: idBenhAn });
  return Array.isArray(data) ? data : [];
}

async function getDonThuocByPhieuKham(idPhieuKham) {
  const data = await cachedGet("ds_donthuoc", { IdPhieuKham: idPhieuKham });
  return Array.isArray(data) ? data : [];
}

module.exports = {
  getBaseUrl,
  getCacheTtlMs,
  getMaxConcurrency,
  getTimeoutMs,
  getBuongPhong,
  getDsLanKham,
  getDonThuocByPhieuKham,
  mapWithConcurrency,
  shouldRejectUnauthorized,
};
