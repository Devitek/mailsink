import { Trans } from '@lingui/react/macro'
import { Link, useLoaderData } from '@tanstack/react-router'

// Empty inbox of the prototype: what to send to see a message appear here in real time.
// The « Load demo messages » button lands with its endpoint (#62).
export function EmptyInbox({ slug }: Readonly<{ slug: string }>) {
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
        <Link
          to="/w/$workspaceSlug/connections"
          params={{ workspaceSlug: slug }}
          className="text-sm text-ms-accent-text underline-offset-4 hover:underline"
        >
          <Trans>Manage connections →</Trans>
        </Link>
      </div>
    </div>
  )
}
