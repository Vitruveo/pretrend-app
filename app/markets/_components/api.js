// Thin client for the market API routes on this site (trailing slashes: the site redirects without them).
async function call(path) {
  const res = await fetch(path, { cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `market API ${res.status}`);
  return data;
}

export const getLive = (slug) => call(`/api/markets/${slug}/live/`);
export const getWindow = (slug, start) => call(`/api/markets/${slug}/window/?start=${start}`);
export const getSettle = (slug, start) => call(`/api/markets/${slug}/settle/?start=${start}`);
