import { useEffect } from 'react';

/**
 * Minimal client-side head management (title, description, Open Graph, robots).
 * NOTE: crawlers that don't execute JS won't see these; pre-rendering public pages is tracked for Phase 4/16.
 */
export function usePageMeta({
  title,
  description,
  noindex = false,
  image,
}: {
  title: string;
  description?: string;
  noindex?: boolean;
  image?: string | null;
}) {
  useEffect(() => {
    document.title = title.includes('Alifya') ? title : `${title} · Alifya Academy`;
    setMeta('name', 'description', description);
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:type', 'website');
    setMeta('property', 'og:image', image ?? undefined);
    setMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow');
    setCanonical(window.location.origin + window.location.pathname);
  }, [title, description, noindex, image]);
}

function setMeta(attr: 'name' | 'property', key: string, value: string | undefined) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!value) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = value;
}

function setCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.rel = 'canonical';
    document.head.appendChild(el);
  }
  el.href = href;
}
