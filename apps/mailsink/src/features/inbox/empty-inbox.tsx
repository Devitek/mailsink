import { Trans, useLingui } from '@lingui/react/macro'
import { Button } from '@mailsink/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useLoaderData } from '@tanstack/react-router'
import { loadDemoMessagesFn } from '../../server-fns/demo-fns'
import { inboxKey } from './queries'

/** « Load demo messages » (#62): the demo set in the UI locale, through the pipeline. */
function useLoadDemo(slug: string) {
  const { i18n } = useLingui()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      loadDemoMessagesFn({ data: { slug, locale: i18n.locale === 'fr' ? 'fr' : 'en' } }),
    // The stream inserts the rows; a refetch covers a stream not connected yet.
    onSuccess: () => qc.invalidateQueries({ queryKey: inboxKey(slug) }),
  })
}

// Empty inbox of the prototype: what to send to see a message appear here in real time,
// or a set of demo messages to look around first.
export function EmptyInbox({ slug }: Readonly<{ slug: string }>) {
  const demo = useLoadDemo(slug)
  const { publicUrl } = useLoaderData({ from: '__root__' })
  const base = (publicUrl ?? '').replace(/\/$/, '')
  const snippet = [
    `curl -X POST ${base}/v1/emails \\`,
    '  -H "Authorization: Bearer msk_…" \\',
    '  -H "Content-Type: application/json" \\',
    `  -d '{"from":"app@example.test","to":"qa@example.test","subject":"Hello","html":"<p>Hi</p>"}'`,
  ].join('\n')
  return (
    <div className="grid flex-1 place-items-center p-8">
      <div className="flex w-full max-w-[560px] flex-col gap-[18px]">
        <h2 className="text-[16px] font-semibold">
          <Trans>
            Empty inbox for <span className="font-mono">{slug}</span>
          </Trans>
        </h2>
        <p className="text-body text-pretty text-ms-text-muted">
          <Trans>
            Emails sent through a connection of this workspace show up here in real time. No message
            ever leaves Mailsink.
          </Trans>
        </p>
        <pre className="m-0 rounded-md border border-ms-border bg-ms-panel px-[22px] py-[19px] font-mono text-xs leading-[1.65] break-all whitespace-pre-wrap text-ms-text-muted">
          {snippet}
        </pre>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button disabled={demo.isPending} onClick={() => demo.mutate()}>
            {demo.isPending ? <Trans>Loading…</Trans> : <Trans>Load demo messages</Trans>}
          </Button>
          <Link
            to="/w/$workspaceSlug/connections"
            params={{ workspaceSlug: slug }}
            className="px-4 text-sm text-ms-accent-text underline-offset-4 hover:underline"
          >
            <Trans>Manage connections →</Trans>
          </Link>
        </div>
        {demo.isError && (
          <p role="alert" className="text-sm text-ms-danger">
            <Trans>The demo messages could not be loaded. Try again.</Trans>
          </p>
        )}
      </div>
    </div>
  )
}
