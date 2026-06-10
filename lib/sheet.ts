let cache: { data: string; expiresAt: number } | null = null;

export async function getFaq(): Promise<string> {
  if (cache && Date.now() < cache.expiresAt) return cache.data;

  const url = process.env.SHEET_CSV_URL;
  if (!url) throw new Error("SHEET_CSV_URL is not set");

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`);
    const data = await res.text();
    cache = { data, expiresAt: Date.now() + 60_000 };
    return data;
  } catch (err) {
    if (cache) {
      console.error(JSON.stringify({ tag: "sheet-stale", error: String(err) }));
      return cache.data;
    }
    throw err;
  }
}
