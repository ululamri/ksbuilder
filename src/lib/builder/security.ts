const SAFE_PATH = /^\/(?!\/)[a-zA-Z0-9/_#?=&.-]*$/;

export function safeLink(value: string): string {
  const link = value.trim();
  if (SAFE_PATH.test(link)) return link;
  try {
    const url = new URL(link);
    return url.protocol === 'https:' ? url.toString() : '#';
  } catch {
    return '#';
  }
}

export function safeImage(value: string): string {
  if (/^\/(?:api\/builder\/media|site-assets)\/[a-f0-9-]+$/i.test(value)) return value;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

export function safeMedia(value: string): string {
  if (/^\/(?:api\/builder\/media|site-assets)\/[a-f0-9-]+$/i.test(value)) return value;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : '';
  } catch { return ''; }
}

export function safeVideoEmbed(value: string): string {
  try {
    const url = new URL(value);
    if (url.hostname === 'youtu.be') return `https://www.youtube-nocookie.com/embed/${url.pathname.slice(1).replace(/[^a-zA-Z0-9_-]/g, '')}`;
    if (['youtube.com', 'www.youtube.com'].includes(url.hostname)) {
      const id = url.searchParams.get('v')?.replace(/[^a-zA-Z0-9_-]/g, '');
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : '';
    }
    if (['vimeo.com', 'www.vimeo.com'].includes(url.hostname)) {
      const id = url.pathname.split('/').filter(Boolean)[0]?.replace(/\D/g, '');
      return id ? `https://player.vimeo.com/video/${id}` : '';
    }
  } catch { /* invalid URL */ }
  return '';
}

export function safeSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
