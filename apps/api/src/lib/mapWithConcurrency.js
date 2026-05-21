/**
 * Executa fn em paralelo com limite de concorrência.
 */
export async function mapWithConcurrency(items, limit, fn) {
  const list = items || [];
  if (!list.length) return [];
  const cap = Math.max(1, Math.min(limit, list.length));
  const results = new Array(list.length);
  let next = 0;

  async function worker() {
    while (next < list.length) {
      const i = next;
      next += 1;
      results[i] = await fn(list[i], i);
    }
  }

  await Promise.all(Array.from({ length: cap }, () => worker()));
  return results;
}
