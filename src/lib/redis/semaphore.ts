import { getRedisClient, KEY_PREFIX } from "./client";

const GPT_SEMAPHORE_MAX = 5;
const GPT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

const SEMINAR_SEMAPHORE_MAX = 8;
const SEMINAR_TIMEOUT_MS = 35 * 60 * 1000; // 35 minutes

// Lua script for atomic acquire
// Returns 1 if acquired, 0 if not
const ACQUIRE_SCRIPT = `
local key = KEYS[1]
local holder_id = ARGV[1]
local max_count = tonumber(ARGV[2])
local timeout_ms = tonumber(ARGV[3])

local current = redis.call('ZCARD', key)
if current < max_count then
  local score = redis.call('TIME')
  local now_ms = tonumber(score[1]) * 1000 + math.floor(tonumber(score[2]) / 1000)
  local expires_at = now_ms + timeout_ms
  redis.call('ZADD', key, expires_at, holder_id)
  return 1
end
return 0
`;

// Lua script for atomic release
// Returns 1 if released, 0 if not found
const RELEASE_SCRIPT = `
local key = KEYS[1]
local holder_id = ARGV[1]

local removed = redis.call('ZREM', key, holder_id)
return removed
`;

// Lua script for cleanup of expired entries and then acquire
// This ensures we clean up expired entries atomically before checking capacity
const CLEANUP_AND_ACQUIRE_SCRIPT = `
local key = KEYS[1]
local holder_id = ARGV[1]
local max_count = tonumber(ARGV[2])
local timeout_ms = tonumber(ARGV[3])

local time_result = redis.call('TIME')
local now_ms = tonumber(time_result[1]) * 1000 + math.floor(tonumber(time_result[2]) / 1000)

redis.call('ZREMRANGEBYSCORE', key, '-inf', now_ms)

local current = redis.call('ZCARD', key)
if current < max_count then
  local expires_at = now_ms + timeout_ms
  redis.call('ZADD', key, expires_at, holder_id)
  return 1
end
return 0
`;

function getGptSemaphoreKey(assignmentId: string): string {
  return `${KEY_PREFIX}:semaphore:gpt:${assignmentId}`;
}

function getSeminarSemaphoreKey(slotId: string): string {
  return `${KEY_PREFIX}:active_seminars:${slotId}`;
}

export interface SemaphoreResult {
  acquired: boolean;
  holderId: string;
}

export async function acquireGptSemaphore(
  assignmentId: string,
  holderId: string
): Promise<SemaphoreResult> {
  const redis = getRedisClient();
  const key = getGptSemaphoreKey(assignmentId);

  const result = await redis.eval(
    CLEANUP_AND_ACQUIRE_SCRIPT,
    1,
    key,
    holderId,
    GPT_SEMAPHORE_MAX,
    GPT_TIMEOUT_MS
  );

  return {
    acquired: result === 1,
    holderId,
  };
}

export async function releaseGptSemaphore(
  assignmentId: string,
  holderId: string
): Promise<boolean> {
  const redis = getRedisClient();
  const key = getGptSemaphoreKey(assignmentId);

  const result = await redis.eval(RELEASE_SCRIPT, 1, key, holderId);

  return result === 1;
}

export async function getGptSemaphoreCount(assignmentId: string): Promise<number> {
  const redis = getRedisClient();
  const key = getGptSemaphoreKey(assignmentId);

  // First clean up expired entries
  const timeResult = await redis.time();
  const nowMs = Number(timeResult[0]) * 1000 + Math.floor(Number(timeResult[1]) / 1000);
  await redis.zremrangebyscore(key, "-inf", String(nowMs));

  return redis.zcard(key);
}

export async function acquireSeminarSemaphore(
  slotId: string,
  holderId: string
): Promise<SemaphoreResult> {
  const redis = getRedisClient();
  const key = getSeminarSemaphoreKey(slotId);

  const result = await redis.eval(
    CLEANUP_AND_ACQUIRE_SCRIPT,
    1,
    key,
    holderId,
    SEMINAR_SEMAPHORE_MAX,
    SEMINAR_TIMEOUT_MS
  );

  return {
    acquired: result === 1,
    holderId,
  };
}

export async function releaseSeminarSemaphore(
  slotId: string,
  holderId: string
): Promise<boolean> {
  const redis = getRedisClient();
  const key = getSeminarSemaphoreKey(slotId);

  const result = await redis.eval(RELEASE_SCRIPT, 1, key, holderId);

  return result === 1;
}

export async function getSeminarSemaphoreCount(slotId: string): Promise<number> {
  const redis = getRedisClient();
  const key = getSeminarSemaphoreKey(slotId);

  // First clean up expired entries
  const timeResult = await redis.time();
  const nowMs = Number(timeResult[0]) * 1000 + Math.floor(Number(timeResult[1]) / 1000);
  await redis.zremrangebyscore(key, "-inf", String(nowMs));

  return redis.zcard(key);
}

export async function extendGptSemaphore(
  assignmentId: string,
  holderId: string,
  additionalMs: number = GPT_TIMEOUT_MS
): Promise<boolean> {
  const redis = getRedisClient();
  const key = getGptSemaphoreKey(assignmentId);

  const score = await redis.zscore(key, holderId);
  if (score === null) {
    return false;
  }

  const timeResult = await redis.time();
  const nowMs = Number(timeResult[0]) * 1000 + Math.floor(Number(timeResult[1]) / 1000);
  const newExpiry = nowMs + additionalMs;

  await redis.zadd(key, String(newExpiry), holderId);
  return true;
}

export async function extendSeminarSemaphore(
  slotId: string,
  holderId: string,
  additionalMs: number = SEMINAR_TIMEOUT_MS
): Promise<boolean> {
  const redis = getRedisClient();
  const key = getSeminarSemaphoreKey(slotId);

  const score = await redis.zscore(key, holderId);
  if (score === null) {
    return false;
  }

  const timeResult = await redis.time();
  const nowMs = Number(timeResult[0]) * 1000 + Math.floor(Number(timeResult[1]) / 1000);
  const newExpiry = nowMs + additionalMs;

  await redis.zadd(key, String(newExpiry), holderId);
  return true;
}
