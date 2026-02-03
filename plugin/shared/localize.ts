/**
 * Localization utilities
 *
 * Provides translations for UI strings and locale helpers.
 */

type TranslationStrings = {
  less: string
  more: string
  loading: string
  noData: string
  error: string
  missing: string
}

const en: TranslationStrings = {
  less: 'Less',
  more: 'More',
  loading: 'Loading history...',
  noData: 'No data available',
  error: 'Failed to load statistics data',
  missing: 'Missing',
}

type Key = keyof TranslationStrings

const translations: Record<string, Partial<TranslationStrings>> = {
  en,
  nl: {
    less: 'Minder',
    more: 'Meer',
    loading: 'Laden...',
    noData: 'Geen gegevens',
    error: 'Laden mislukt',
    missing: 'Ontbreekt',
  },
  de: {
    less: 'Weniger',
    more: 'Mehr',
    loading: 'Laden...',
    noData: 'Keine Daten',
    error: 'Fehler beim Laden',
    missing: 'Fehlt',
  },
  fr: {
    less: 'Moins',
    more: 'Plus',
    loading: 'Chargement...',
    noData: 'Aucune donnée',
    error: 'Erreur de chargement',
    missing: 'Manquant',
  },
  es: {
    less: 'Menos',
    more: 'Más',
    loading: 'Cargando...',
    noData: 'Sin datos',
    error: 'Error al cargar',
    missing: 'Falta',
  },
}

export const t = (key: Key, locale = 'en'): string =>
  translations[locale.split('-')[0]]?.[key] ?? en[key]
