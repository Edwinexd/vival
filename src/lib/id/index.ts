const ID_GENERATOR_URL = process.env.ID_GENERATOR_URL || 'http://localhost:8080';

export async function generateId(): Promise<string> {
  const res = await fetch(`${ID_GENERATOR_URL}/id`);
  if (!res.ok) throw new Error('Failed to generate ID');
  const data = await res.json();
  return data.id;
}

export async function generateIds(count: number): Promise<string[]> {
  if (count < 1 || count > 4096000) throw new Error('Count must be 1-4096000');
  const res = await fetch(`${ID_GENERATOR_URL}/ids/${count}`);
  if (!res.ok) throw new Error('Failed to generate IDs');
  const data = await res.json();
  return data.ids;
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${ID_GENERATOR_URL}/health`);
    const data = await res.json();
    return data.status === 'healthy';
  } catch {
    return false;
  }
}
