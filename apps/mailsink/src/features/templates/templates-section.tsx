import { Trans, useLingui } from '@lingui/react/macro'
import { Button } from '@mailsink/ui'
import { useSuspenseInfiniteQuery } from '@tanstack/react-query'
import { SectionHeader } from '../settings/section-header'
import { ConfirmDialog } from '../workspaces/confirm-dialog'
import { templatesQuery, useTemplateMutations } from './queries'
import { TemplateEditor } from './template-editor'
import { senderText } from './template-form'

const COLUMNS = 'grid grid-cols-[80px_minmax(0,1fr)_minmax(0,1.4fr)_150px] items-center gap-4'

// « Templates Brevo » section (#43, Admin API #30): the `templateId` values a Brevo client
// may send, with their subject, sender and an editor with a rendered preview.
export function TemplatesSection({ slug }: Readonly<{ slug: string }>) {
  const { t, i18n } = useLingui()
  const list = useSuspenseInfiniteQuery(templatesQuery(slug))
  const templates = list.data.pages.flatMap((p) => p.data)
  const { remove } = useTemplateMutations(slug)
  const params = '{{ params.x }}'
  const contact = '{{ contact.X }}'

  return (
    <div>
      <SectionHeader
        title={<Trans>Brevo templates</Trans>}
        description={
          <Trans>
            Used by POST /v3/smtp/email with a templateId; {params} and {contact} placeholders are
            rendered.
          </Trans>
        }
      >
        <TemplateEditor
          slug={slug}
          trigger={<Button variant="primary" size="sm" />}
          triggerLabel={<Trans>+ New template</Trans>}
        />
      </SectionHeader>
      <div className="overflow-auto rounded-lg border border-ms-border bg-ms-panel">
        <div className="min-w-[640px]">
          <div
            className={`${COLUMNS} h-[34px] border-b border-ms-border px-[19px] text-label font-medium tracking-[0.06em] text-ms-text-faint uppercase`}
          >
            <span>ID</span>
            <span>
              <Trans>Name</Trans>
            </span>
            <span>
              <Trans>Subject</Trans>
            </span>
            <span />
          </div>
          {templates.map((template) => {
            const id = template.externalId
            const name = template.name
            return (
              <div
                key={template.id}
                data-testid="template-row"
                className={`${COLUMNS} min-h-[48px] border-b border-ms-border px-[19px] py-2 text-sm last:border-b-0`}
              >
                <span className="font-mono">{id}</span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{name}</span>
                  <span className="block truncate text-xs text-ms-text-faint">
                    {senderText(template.sender) ||
                      i18n.date(template.updatedAt, { dateStyle: 'medium' })}
                  </span>
                </span>
                <span className="truncate font-mono text-xs text-ms-text-muted">
                  {template.subject}
                </span>
                <span className="flex justify-end gap-2">
                  <TemplateEditor
                    slug={slug}
                    template={template}
                    trigger={<Button size="sm" aria-label={t`Edit template ${id}`} />}
                    triggerLabel={<Trans>Edit</Trans>}
                  />
                  <ConfirmDialog
                    danger
                    trigger={
                      <Button variant="danger" size="sm" aria-label={t`Delete template ${id}`} />
                    }
                    triggerLabel={<Trans>Delete</Trans>}
                    title={<Trans>Delete the template {name}?</Trans>}
                    description={
                      <Trans>Brevo calls sending templateId {id} are refused afterwards.</Trans>
                    }
                    confirmLabel={<Trans>Delete</Trans>}
                    onConfirm={() => remove.mutateAsync(id)}
                  />
                </span>
              </div>
            )
          })}
          {templates.length === 0 && (
            <p className="px-[19px] py-[27px] text-center text-sm text-ms-text-faint">
              <Trans>No template yet.</Trans>
            </p>
          )}
        </div>
      </div>
      {list.hasNextPage && (
        <div className="mt-[13px] flex justify-center">
          <Button
            variant="outline"
            disabled={list.isFetchingNextPage}
            onClick={() => void list.fetchNextPage()}
          >
            <Trans>Load more</Trans>
          </Button>
        </div>
      )}
    </div>
  )
}
