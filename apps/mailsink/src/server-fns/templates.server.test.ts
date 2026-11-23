import { CreateWorkspaceRequest, TemplateInput, TemplatePatch } from '@mailsink/contracts'
import { describeDb } from '@mailsink/db/testing'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { installTestRuntime } from '../http/test-fixtures'
import { stopRuntime } from '../runtime/boot'
import type { Runtime } from '../runtime/container'
import {
  addTemplate,
  changeTemplate,
  deleteTemplate,
  listTemplates,
  previewTemplate,
} from './templates.server'
import { createWorkspaceFromUi } from './workspaces-manage.server'

describeDb('UI Brevo templates', (ctx) => {
  let runtime: Runtime
  beforeAll(async () => {
    runtime = await installTestRuntime(ctx.handle)
    const created = await createWorkspaceFromUi(
      runtime,
      CreateWorkspaceRequest.parse({ name: 'Tpl', slug: 'tpl-ui' }),
    )
    if (!created.ok) throw new Error('expected a workspace')
  })
  afterAll(() => stopRuntime())

  it('creates, lists, edits and deletes templates by numeric id', async () => {
    const first = await addTemplate(
      runtime,
      'tpl-ui',
      TemplateInput.parse({
        externalId: 12,
        name: 'Welcome',
        subject: 'Hi {{ params.name }}',
        html: '<p>Hi</p>',
        sender: 'Shop <shop@x.test>',
      }),
    )
    expect(first).toMatchObject({
      ok: true,
      template: { externalId: 12, sender: { email: 'shop@x.test', name: 'Shop' } },
    })
    const next = await addTemplate(
      runtime,
      'tpl-ui',
      TemplateInput.parse({ name: 'Reset', subject: 'Reset', text: 'Reset' }),
    )
    expect(next.ok && next.template.externalId).toBe(13)
    const taken = await addTemplate(
      runtime,
      'tpl-ui',
      TemplateInput.parse({ externalId: 12, name: 'Dup', subject: 's', text: 't' }),
    )
    expect(taken).toMatchObject({ ok: false, issues: [{ path: 'externalId', code: 'conflict' }] })

    const empty = await changeTemplate(runtime, 'tpl-ui', 13, TemplatePatch.parse({ text: null }))
    expect(empty).toMatchObject({ ok: false, issues: [{ code: 'html_or_text_required' }] })
    const renamed = await changeTemplate(
      runtime,
      'tpl-ui',
      12,
      TemplatePatch.parse({ name: 'Welcome v2' }),
    )
    expect(renamed.ok && renamed.template.name).toBe('Welcome v2')

    expect((await listTemplates(runtime, 'tpl-ui')).map((t) => t.externalId)).toEqual([12, 13])
    await deleteTemplate(runtime, 'tpl-ui', 13)
    expect((await listTemplates(runtime, 'tpl-ui')).map((t) => t.externalId)).toEqual([12])
  })

  it('renders a preview with sample params, html values escaped', async () => {
    const preview = await previewTemplate(runtime, 'tpl-ui', {
      subject: 'Hi {{ params.name | upper }}',
      html: '<p>{{ params.name }} · {{ contact.EMAIL }}</p>',
      text: 'Hi {{ params.missing | default: "there" }}',
      params: { name: '<Jo>' },
      contactEmail: 'jo@x.test',
    })
    expect(preview).toEqual({
      subject: 'Hi <JO>',
      html: '<p>&lt;Jo&gt; · jo@x.test</p>',
      text: 'Hi there',
    })
  })
})
