import { describe, it, expect } from 'vitest';
import { createInstance } from 'i18next';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import en from '../locales/en.json';
import vi from '../locales/vi.json';

function flatten(value: unknown, prefix = ''): string[] {
  if (typeof value === 'string') return [prefix];
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) => flatten(child, prefix ? `${prefix}.${key}` : key));
}
function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(dir, entry.name);
    return entry.isDirectory() ? sources(path) : /(?<!\.test)\.tsx?$/.test(path) ? [path] : [];
  });
}

describe('translation resources', () => {
  it('keeps EN and VI leaf keys in parity', () => {
    expect(flatten(en).sort()).toEqual(flatten(vi).sort());
  });
  it('resolves static translation keys used by components and route metadata', () => {
    const keys = new Set(flatten(en));
    const missing = new Set<string>();
    for (const file of sources(resolve('src'))) {
      if (file.includes('/i18n/__tests__/')) continue;
      const text = readFileSync(file, 'utf8');
      const matches = [...text.matchAll(/\bt\(['"]([^'"]+)['"]/g), ...text.matchAll(/(?:titleKey|subtitleKey|descriptionKey|labelKey|categoryKey|metricLabelKey|i18nKey)[:=]\s*['"]([^'"]+)['"]/g)];
      for (const match of matches) if (match[1] && !keys.has(match[1])) missing.add(match[1]);
    }
    expect([...missing].sort()).toEqual([]);
  });
  it('switches EN → VI → EN with fallback and all screen headings', async () => {
    const i18n = createInstance();
    await i18n.init({ resources: { en: { translation: en }, vi: { translation: vi } }, lng: 'en', fallbackLng: 'en' });
    const routes = ['catalog','bronze','silver','gold','crawler','kafka','airflow','dq','health'];
    for (const lang of ['en','vi','en']) {
      await i18n.changeLanguage(lang);
      for (const route of routes) expect(i18n.t(`screens.${route}.title`)).not.toContain('screens.');
      expect(i18n.t('schematic.title')).not.toBe('schematic.title');
    }
    await i18n.changeLanguage('fr');
    expect(i18n.t('screens.catalog.title')).toBe(en.screens.catalog.title);
  });
});
