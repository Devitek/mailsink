import { TemplateInput, TemplatePatch } from '@mailsink/contracts'
import { describe, expect, it } from 'vitest'
import {
  parseParams,
  templateDefaults,
  templateSchema,
  templateValues,
  toTemplateInput,
  toTemplatePatch,
} from './template-form'

const messages = { required: 'required', body: 'body', id: 'id', sender: 'sender' }

describe('template form', () => {
  it('builds a creation request, a blank id letting the server number it', () => {
    const values = {
      ...templateDefaults(),
      name: ' Welcome ',
      subject: 'Hi {{ params.name }}',
      html: '<p>Hi</p>',
      sender: 'Shop <shop@x.test>',
    }
    expect(TemplateInput.parse(toTemplateInput(values))).toEqual({
      name: 'Welcome',
      subject: 'Hi {{ params.name }}',
      html: '<p>Hi</p>',
      text: null,
      sender: { email: 'shop@x.test', name: 'Shop' },
    })
    expect(toTemplateInput({ ...values, externalId: '42' }).externalId).toBe(42)
  })

  it('reads a template back and patches every field, blanks cleared', () => {
    const values = templateValues({
      id: 'tpl_1',
      externalId: 7,
      name: 'Reset',
      subject: 'Reset',
      html: null,
      text: 'Reset',
      sender: { email: 'a@x.test', name: null },
      createdAt: '',
      updatedAt: '',
    })
    expect(values).toMatchObject({ externalId: '7', html: '', sender: 'a@x.test' })
    expect(TemplatePatch.parse(toTemplatePatch({ ...values, sender: '' }))).toEqual({
      name: 'Reset',
      subject: 'Reset',
      html: null,
      text: 'Reset',
      sender: null,
    })
  })

  it('needs a name, a body, a positive id and a valid sender', () => {
    const result = templateSchema(messages).safeParse({
      ...templateDefaults(),
      externalId: '0',
      sender: 'not an address',
    })
    expect(result.error?.issues.map((i) => i.path.join('.'))).toEqual([
      'externalId',
      'name',
      'sender',
      'html',
    ])
  })

  it('parses sample params as a JSON object only', () => {
    expect(parseParams('')).toEqual({ ok: true, params: {} })
    expect(parseParams('{"name":"Jo"}')).toEqual({ ok: true, params: { name: 'Jo' } })
    expect(parseParams('[1]').ok).toBe(false)
    expect(parseParams('{').ok).toBe(false)
  })
})
