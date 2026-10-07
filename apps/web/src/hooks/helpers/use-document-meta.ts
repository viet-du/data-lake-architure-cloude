import { useEffect } from 'react';

export interface DocumentMeta {
  title: string;
  description?: string | undefined;
  keywords?: string | undefined;
  ogTitle?: string | undefined;
  ogDescription?: string | undefined;
  ogType?: 'website' | 'article' | 'profile' | undefined;
}

const DEFAULT_TITLE = 'Lakehouse Control Plane';

function setMetaTag(name: string, value: string, attr: 'name' | 'property' = 'name'): void {
  if (typeof document === 'undefined') return;
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);
  if (tag === null) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, name);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', value);
}

function setTitle(value: string): void {
  if (typeof document === 'undefined') return;
  document.title = value;
}

export function useDocumentMeta(meta: DocumentMeta): void {
  useEffect(() => {
    setTitle(meta.title === '' ? DEFAULT_TITLE : meta.title);
    if (meta.description !== undefined) {
      setMetaTag('description', meta.description);
    }
    if (meta.keywords !== undefined) {
      setMetaTag('keywords', meta.keywords);
    }
    if (meta.ogTitle !== undefined) {
      setMetaTag('og:title', meta.ogTitle, 'property');
    }
    if (meta.ogDescription !== undefined) {
      setMetaTag('og:description', meta.ogDescription, 'property');
    }
    if (meta.ogType !== undefined) {
      setMetaTag('og:type', meta.ogType, 'property');
    }
  }, [meta.title, meta.description, meta.keywords, meta.ogTitle, meta.ogDescription, meta.ogType]);
}
