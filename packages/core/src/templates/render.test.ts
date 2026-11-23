import { describe, expect, it } from 'vitest'
import { renderTemplate } from './render'

const ctx = {
  params: { name: 'Jane', order: { id: 42, items: ['a', 'b'] }, html: '<b>x</b>', zero: 0 },
  contact: { EMAIL: 'jane@x.io' },
}

describe('renderTemplate', () => {
  it('replaces params and contact placeholders, with or without spaces', () => {
    expect(renderTemplate('Hi {{params.name}}, {{ contact.EMAIL }}', ctx)).toBe(
      'Hi Jane, jane@x.io',
    )
  })

  it('follows dotted paths and prints numbers, zero included', () => {
    expect(renderTemplate('#{{ params.order.id }} {{ params.zero }}', ctx)).toBe('#42 0')
  })

  it('prints JSON for objects and arrays', () => {
    expect(renderTemplate('{{ params.order.items }}', ctx)).toBe('["a","b"]')
  })

  it('renders an unknown variable as an empty string', () => {
    expect(renderTemplate('[{{ params.missing.deep }}][{{ contact.FIRSTNAME }}]', ctx)).toBe('[][]')
  })

  it('applies the default, upper and lower filters', () => {
    expect(renderTemplate('{{ params.missing | default: "friend" }}', ctx)).toBe('friend')
    expect(renderTemplate("{{ params.name|default:'x'|upper }}", ctx)).toBe('JANE')
    expect(renderTemplate('{{ params.name | lower }}', ctx)).toBe('jane')
  })

  it('escapes HTML in html mode unless the safe filter is used', () => {
    expect(renderTemplate('{{ params.html }}', ctx, { html: true })).toBe('&lt;b&gt;x&lt;/b&gt;')
    expect(renderTemplate('{{ params.html | safe }}', ctx, { html: true })).toBe('<b>x</b>')
    expect(renderTemplate('{{ params.html }}', ctx)).toBe('<b>x</b>')
  })

  it('never reads inherited properties', () => {
    expect(renderTemplate('[{{ params.constructor }}][{{ params.__proto__ }}]', ctx)).toBe('[][]')
    expect(renderTemplate('[{{ params.name.length }}]', ctx)).toBe('[]')
  })

  it('leaves other tags and blocks untouched', () => {
    const source = '{{ unsubscribe }} {% if params.name %}x{% endif %} {{ 1 + 1 }}'
    expect(renderTemplate(source, ctx)).toBe(source)
  })
})
