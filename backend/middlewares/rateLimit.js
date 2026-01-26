// Install dependencies:
//   npm install express-rate-limit rate-limit-redis ioredis
//
// This module exports two rate limiters:
// - generalLimiter: reasonable default for API-wide throttling
// - loginLimiter: stricter limits for authentication endpoints (login)
//
// It will use Redis (when REDIS_URL env var is present) to provide a shared store across processes.
// Otherwise it falls back to the express-rate-limit in-memory store (suitable only for single-process dev).
//
// Environment variables (optional):
// - REDIS_URL           (e.g. redis://:pass@host:6379/0) -> enables Redis-backed store
// - RATE_WINDOW_MINUTES (defaults to 15)
// - RATE_GENERAL_MAX    (defaults to 100 per window)
// - LOGIN_MAX_ATTEMPTS  (defaults to 5 per window)
import rateLimit from 'express-rate-limit';

let RedisStore;
let IORedis;
let redisClient = null;

const {
  REDIS_URL,
  RATE_WINDOW_MINUTES = '15',
  RATE_GENERAL_MAX = '100',
  LOGIN_MAX_ATTEMPTS = '5',
} = process.env;

const windowMs = Math.max(1, Number(RATE_WINDOW_MINUTES || 15)) * 60 * 1000;

try {
  // optional dependencies for Redis-backed store (enterprise)
  // If these are not installed or REDIS_URL is not provided, we will skip Redis.
  if (REDIS_URL) {
    // Require dynamically so dev environments without the packages don't crash during import
    // Make sure you installed: rate-limit-redis ioredis
    // npm i rate-limit-redis ioredis
    // rate-limit-redis expects a `sendCommand` function for ioredis client compatibility.
    // See code comment below for usage.
    // eslint-disable-next-line global-require
    RedisStore = require('rate-limit-redis');
    // eslint-disable-next-line global-require
    IORedis = require('ioredis');
    redisClient = new IORedis(REDIS_URL);
  }
} catch (err) {
  // If redis-related packages are not installed or fail to load, we will fallback to memory store.
  // Log to console so the operator knows to install packages for production.
  // Do not throw here to keep development flow smooth.
  // eslint-disable-next-line no-console
  console.warn('Rate limiter Redis store not configured/available. Falling back to in-memory store.', err?.message || err);
}

/**
 * Build options object with optional Redis store
 * @param {object} opts base options (windowMs, max, etc)
 */
const buildOptions = (opts = {}) => {
  const base = {
    windowMs,
    standardHeaders: true, // RFC-rate-limit headers
    legacyHeaders: false, // disable the `X-RateLimit-*` headers
    ...opts,
  };

  if (redisClient && RedisStore) {
    // For ioredis compatibility, use the sendCommand adapter required by rate-limit-redis
    // (rate-limit-redis expects a `sendCommand` callback when using ioredis)
    // See: https://www.npmjs.com/package/rate-limit-redis
    base.store = new RedisStore({
      sendCommand: (...args) => redisClient.call(...args),
    });
  }

  return base;
};

// General API limiter: prevents abuse of public API endpoints
export const generalLimiter = rateLimit(
  buildOptions({
    max: Number(RATE_GENERAL_MAX || 100),
    message: {
      success: false,
      message: 'Too many requests from this IP, please try again later.',
    },
  })
);

// Login-specific limiter: strict, intended to prevent brute-force
export const loginLimiter = rateLimit(
  buildOptions({
    windowMs, // same window as general or you can set custom below
    max: Number(LOGIN_MAX_ATTEMPTS || 5),
    // Do not count successful logins against the limit (helps avoid lockouts)
    // Note: skipSuccessfulRequests relies on res.statusCode < 400 to consider success.
    skipSuccessfulRequests: true,
    handler: (req, res /*, next */) => {
      // Custom JSON payload and 429 status:
      const retryAfterSec = Math.ceil((windowMs) / 1000);
      res.status(429).json({
        success: false,
        message: `Too many login attempts. Please try again after ${Math.ceil(retryAfterSec / 60)} minute(s).`,
      });
    },
  })
);

// For convenience export fallback info
export default {
  generalLimiter,
  loginLimiter,
};