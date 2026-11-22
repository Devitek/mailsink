import { Slug } from '@mailsink/contracts'
import { describe, expect, it } from 'vitest'
import { generateSlug, slugify } from './slug'

describe('workspace slugs', () => {
  it('slugifies names, accents and symbols included', () => {
    expect(slugify('  Acme Studio — Staging! ')).toBe('acme-studio-staging')
    expect(slugify('Équipe Été')).toBe('equipe-ete')
    expect(slugify('***')).toBe('workspace')
    expect(slugify('x'.repeat(200))).toHaveLength(56)
  })

  it('appends a random suffix that keeps the contract pattern', () => {
    for (const name of ['CI run 42', 'é', 'a'.repeat(200), '-']) {
      const slug = generateSlug(name)
      expect(Slug.safeParse(slug).success, slug).toBe(true)
    }
    expect(generateSlug('CI run 42')).toMatch(/^ci-run-42-[a-z0-9]{6}$/)
  })
})
