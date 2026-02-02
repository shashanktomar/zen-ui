import { describe, it, expect } from 'vitest'
import { t } from './localize'

describe('t (translation function)', () => {
  describe('English (default)', () => {
    it('returns English strings for "en" locale', () => {
      expect(t('less', 'en')).toBe('Less')
      expect(t('more', 'en')).toBe('More')
      expect(t('loading', 'en')).toBe('Loading history...')
      expect(t('noData', 'en')).toBe('No data available')
      expect(t('error', 'en')).toBe('Failed to load statistics data')
    })

    it('defaults to English when no locale provided', () => {
      expect(t('less')).toBe('Less')
      expect(t('more')).toBe('More')
    })
  })

  describe('Dutch (nl)', () => {
    it('returns Dutch strings', () => {
      expect(t('less', 'nl')).toBe('Minder')
      expect(t('more', 'nl')).toBe('Meer')
      expect(t('loading', 'nl')).toBe('Laden...')
      expect(t('noData', 'nl')).toBe('Geen gegevens')
      expect(t('error', 'nl')).toBe('Laden mislukt')
    })
  })

  describe('German (de)', () => {
    it('returns German strings', () => {
      expect(t('less', 'de')).toBe('Weniger')
      expect(t('more', 'de')).toBe('Mehr')
      expect(t('loading', 'de')).toBe('Laden...')
      expect(t('noData', 'de')).toBe('Keine Daten')
      expect(t('error', 'de')).toBe('Fehler beim Laden')
    })
  })

  describe('French (fr)', () => {
    it('returns French strings', () => {
      expect(t('less', 'fr')).toBe('Moins')
      expect(t('more', 'fr')).toBe('Plus')
      expect(t('loading', 'fr')).toBe('Chargement...')
      expect(t('noData', 'fr')).toBe('Aucune donnée')
      expect(t('error', 'fr')).toBe('Erreur de chargement')
    })
  })

  describe('Spanish (es)', () => {
    it('returns Spanish strings', () => {
      expect(t('less', 'es')).toBe('Menos')
      expect(t('more', 'es')).toBe('Más')
      expect(t('loading', 'es')).toBe('Cargando...')
      expect(t('noData', 'es')).toBe('Sin datos')
      expect(t('error', 'es')).toBe('Error al cargar')
    })
  })

  describe('locale variants', () => {
    it('handles locale with region code (e.g., nl-BE)', () => {
      expect(t('less', 'nl-BE')).toBe('Minder')
      expect(t('more', 'de-AT')).toBe('Mehr')
      expect(t('loading', 'fr-CA')).toBe('Chargement...')
    })
  })

  describe('fallback behavior', () => {
    it('falls back to English for unsupported locales', () => {
      expect(t('less', 'ja')).toBe('Less')
      expect(t('more', 'zh')).toBe('More')
      expect(t('loading', 'ko')).toBe('Loading history...')
    })

    it('falls back to English for empty string locale', () => {
      expect(t('less', '')).toBe('Less')
    })
  })
})
