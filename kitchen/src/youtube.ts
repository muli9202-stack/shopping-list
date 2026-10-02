/** Extracts the 11-character video id from any common YouTube link form. */
export function youtubeId(input: string): string | null {
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  let url: URL;
  try {
    url = new URL(s.startsWith('http') ? s : `https://${s}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m|music)\./, '');
  let id: string | null = null;
  if (host === 'youtu.be') id = url.pathname.slice(1).split('/')[0];
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    id = url.searchParams.get('v');
    if (!id) {
      const m = url.pathname.match(/^\/(?:shorts|embed|live|v)\/([\w-]{11})/);
      if (m) id = m[1];
    }
  }
  return id && /^[\w-]{11}$/.test(id) ? id : null;
}

export const thumbUrl = (id: string, size: 'mq' | 'hq' | 'sd' = 'hq') => `https://i.ytimg.com/vi/${id}/${size}default.jpg`;
export const watchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;
export const embedUrl = (id: string) => `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`;

/** Title via YouTube's public oEmbed endpoint (CORS-enabled, no key needed). */
export async function fetchTitle(id: string): Promise<string | null> {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watchUrl(id))}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { title?: string };
    return data.title?.trim() || null;
  } catch {
    return null;
  }
}

/**
 * The full video description needs the YouTube Data API (the only official,
 * browser-safe source). Requires a free API key from the user.
 */
export async function fetchSnippet(id: string, apiKey: string): Promise<{ title: string; description: string } | null> {
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${id}&key=${encodeURIComponent(apiKey)}`,
  );
  if (!res.ok) throw new Error(res.status === 400 || res.status === 403 ? 'מפתח ה-API לא תקין' : `שגיאה ${res.status}`);
  const data = (await res.json()) as { items?: { snippet: { title: string; description: string } }[] };
  const sn = data.items?.[0]?.snippet;
  return sn ? { title: sn.title, description: sn.description } : null;
}
