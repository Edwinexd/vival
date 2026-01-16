import { getRedisClient, KEY_PREFIX } from "./client";

const EMAIL_QUEUE_KEY = `${KEY_PREFIX}:email:queue`;
const EMAIL_PROCESSING_KEY = `${KEY_PREFIX}:email:processing`;

export interface EmailJob {
  id: string;
  to: string;
  subject: string;
  body: string;
  createdAt: number;
  attempts: number;
  metadata?: Record<string, unknown>;
}

// Lua script for atomic dequeue with move to processing set
const DEQUEUE_SCRIPT = `
local queue_key = KEYS[1]
local processing_key = KEYS[2]
local timeout_ms = tonumber(ARGV[1])

local job = redis.call('LPOP', queue_key)
if job then
  local time_result = redis.call('TIME')
  local now_ms = tonumber(time_result[1]) * 1000 + math.floor(tonumber(time_result[2]) / 1000)
  local expires_at = now_ms + timeout_ms
  redis.call('ZADD', processing_key, expires_at, job)
  return job
end
return nil
`;

// Lua script for completing a job (remove from processing)
const COMPLETE_SCRIPT = `
local processing_key = KEYS[1]
local job_data = ARGV[1]

return redis.call('ZREM', processing_key, job_data)
`;

// Lua script for requeueing failed/expired jobs
const REQUEUE_EXPIRED_SCRIPT = `
local processing_key = KEYS[1]
local queue_key = KEYS[2]

local time_result = redis.call('TIME')
local now_ms = tonumber(time_result[1]) * 1000 + math.floor(tonumber(time_result[2]) / 1000)

local expired = redis.call('ZRANGEBYSCORE', processing_key, '-inf', now_ms)
if #expired > 0 then
  for i, job in ipairs(expired) do
    redis.call('RPUSH', queue_key, job)
    redis.call('ZREM', processing_key, job)
  end
end
return #expired
`;

export async function enqueueEmail(job: Omit<EmailJob, "createdAt" | "attempts">): Promise<void> {
  const redis = getRedisClient();

  const fullJob: EmailJob = {
    ...job,
    createdAt: Date.now(),
    attempts: 0,
  };

  await redis.rpush(EMAIL_QUEUE_KEY, JSON.stringify(fullJob));
}

export async function dequeueEmail(processingTimeoutMs: number = 60000): Promise<EmailJob | null> {
  const redis = getRedisClient();

  const result = await redis.eval(
    DEQUEUE_SCRIPT,
    2,
    EMAIL_QUEUE_KEY,
    EMAIL_PROCESSING_KEY,
    processingTimeoutMs
  );

  if (result === null) {
    return null;
  }

  const job = JSON.parse(result as string) as EmailJob;
  job.attempts += 1;

  // Update the job in processing with incremented attempts
  await redis.zrem(EMAIL_PROCESSING_KEY, result as string);
  await redis.zadd(
    EMAIL_PROCESSING_KEY,
    Date.now() + processingTimeoutMs,
    JSON.stringify(job)
  );

  return job;
}

export async function completeEmail(job: EmailJob): Promise<boolean> {
  const redis = getRedisClient();

  const result = await redis.eval(
    COMPLETE_SCRIPT,
    1,
    EMAIL_PROCESSING_KEY,
    JSON.stringify(job)
  );

  return result === 1;
}

export async function failEmail(job: EmailJob, requeue: boolean = true): Promise<void> {
  const redis = getRedisClient();

  await redis.zrem(EMAIL_PROCESSING_KEY, JSON.stringify(job));

  if (requeue && job.attempts < 3) {
    await redis.rpush(EMAIL_QUEUE_KEY, JSON.stringify(job));
  }
}

export async function requeueExpiredEmails(): Promise<number> {
  const redis = getRedisClient();

  const result = await redis.eval(
    REQUEUE_EXPIRED_SCRIPT,
    2,
    EMAIL_PROCESSING_KEY,
    EMAIL_QUEUE_KEY
  );

  return result as number;
}

export async function getQueueLength(): Promise<number> {
  const redis = getRedisClient();
  return redis.llen(EMAIL_QUEUE_KEY);
}

export async function getProcessingCount(): Promise<number> {
  const redis = getRedisClient();
  return redis.zcard(EMAIL_PROCESSING_KEY);
}

export async function peekQueue(count: number = 10): Promise<EmailJob[]> {
  const redis = getRedisClient();
  const items = await redis.lrange(EMAIL_QUEUE_KEY, 0, count - 1);
  return items.map((item) => JSON.parse(item) as EmailJob);
}
