import { Trans, useLingui } from '@lingui/react/macro'
import { Button, Input } from '@mailsink/ui'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { ConfirmDialog } from '../workspaces/confirm-dialog'
import { suppressionsQuery, useSuppressionMutations } from './queries'
import { SuppressionTable } from './suppression-table'

const FILTER_DELAY_MS = 300

type SuppressionsScreenProps = {
  slug: string
  email: string | undefined
  onEmail: (email: string | undefined) => void
}

// « Suppression list » of the prototype (#42): addresses the simulation stores `suppressed`
// without drawing a status, newest first, server pages of 50 with « Load more », an address
// filter kept in the URL, removal of one address and reset of the whole list.
export function SuppressionsScreen({ slug, email, onEmail }: SuppressionsScreenProps) {
  const { t } = useLingui()
  const [text, setText] = useState(email ?? '')
  useEffect(() => setText(email ?? ''), [email])
  useEffect(() => {
    if (text.trim() === (email ?? '')) return
    const id = setTimeout(() => onEmail(text.trim() || undefined), FILTER_DELAY_MS)
    return () => clearTimeout(id)
  }, [text, email, onEmail])

  const list = useInfiniteQuery(suppressionsQuery(slug, email))
  const { removeOne, resetAll } = useSuppressionMutations(slug)
  const rows = list.data?.pages.flatMap((p) => p.data) ?? []

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-[13px] px-[27px] py-[30px] max-sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-[13px]">
          <div>
            <h2 className="font-semibold">
              <Trans>Suppression list</Trans>
            </h2>
            <p className="text-xs text-ms-text-faint">
              <Trans>
                Sends to these addresses are stored <span className="font-mono">suppressed</span>{' '}
                without drawing a status.
              </Trans>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Input
              type="search"
              value={text}
              onValueChange={(value: string) => setText(value)}
              placeholder={t`Filter by address`}
              aria-label={t`Filter by address`}
              className="w-[240px] font-mono"
            />
            <ConfirmDialog
              danger
              trigger={<Button variant="danger" disabled={rows.length === 0 && !email} />}
              triggerLabel={<Trans>Reset the list</Trans>}
              title={<Trans>Reset the suppression list?</Trans>}
              description={
                <Trans>
                  Every address is removed: the next sends to them draw a status again. The filter
                  does not apply, the whole list is emptied.
                </Trans>
              }
              confirmLabel={<Trans>Reset</Trans>}
              onConfirm={() => resetAll.mutateAsync()}
            />
          </div>
        </div>
        <SuppressionTable
          rows={rows}
          loading={list.isPending}
          filtered={email !== undefined}
          slug={slug}
          onRemove={(address) => removeOne.mutate(address)}
        />
        {(removeOne.isError || list.isError) && (
          <p role="alert" className="text-sm text-ms-danger">
            <Trans>That did not work. Try again.</Trans>
          </p>
        )}
        {list.hasNextPage && (
          <Button
            variant="outline"
            className="self-center"
            disabled={list.isFetchingNextPage}
            onClick={() => void list.fetchNextPage()}
          >
            <Trans>Load more</Trans>
          </Button>
        )}
      </div>
    </div>
  )
}
