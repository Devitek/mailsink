import { Trans } from '@lingui/react/macro'
import { Button } from '@mailsink/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { purgeInboxFn } from '../../server-fns/messages-fns'
import { inboxKey } from '../inbox/queries'

/** The confirmation step goes back to rest after this delay. */
const CONFIRM_MS = 6_000

// « Purge the inbox » of the prototype: a first click asks for confirmation (with the count),
// the second deletes every message of the workspace. Logs are kept.
export function PurgeButton({
  slug,
  count,
  onPurged,
}: Readonly<{ slug: string; count: number; onPurged: () => void }>) {
  const qc = useQueryClient()
  const [confirming, setConfirming] = useState(false)
  const purge = useMutation({
    mutationFn: () => purgeInboxFn({ data: { slug } }),
    onSuccess: () => {
      setConfirming(false)
      onPurged()
      return qc.invalidateQueries({ queryKey: inboxKey(slug) })
    },
  })
  useEffect(() => {
    if (!confirming) return
    const id = setTimeout(() => setConfirming(false), CONFIRM_MS)
    return () => clearTimeout(id)
  }, [confirming])

  if (!confirming) {
    return (
      <Button variant="outline" onClick={() => setConfirming(true)}>
        <Trans>Purge the inbox</Trans>
      </Button>
    )
  }
  return (
    <>
      <Button variant="ghost" onClick={() => setConfirming(false)}>
        <Trans>Cancel</Trans>
      </Button>
      <Button variant="danger" disabled={purge.isPending} onClick={() => purge.mutate()}>
        <Trans>Confirm the purge ({count})</Trans>
      </Button>
    </>
  )
}
