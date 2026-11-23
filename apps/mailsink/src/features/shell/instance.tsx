import { cn } from '@mailsink/ui'
import { getRouteApi } from '@tanstack/react-router'

const root = getRouteApi('__root__')

/** Instance facts loaded once by the root loader: public URL, version, UI auth mode. */
export function useInstance() {
  const { publicUrl, instance } = root.useLoaderData()
  return { publicUrl, ...instance }
}

/** `https://` faint, then the host and path: the part that tells instances apart. */
export function splitUrl(url: string): [scheme: string, rest: string] {
  const match = url.match(/^([a-z]+:\/\/)(.*)$/i)
  return match ? [match[1] ?? '', match[2] ?? ''] : ['', url]
}

// Instance reminder (L1a « bloc instance », H2b « Instance »): URL and version, in mono.
export function InstanceDetails({ className }: Readonly<{ className?: string }>) {
  const { publicUrl, version } = useInstance()
  const [scheme, rest] = splitUrl(publicUrl)
  return (
    <div className={cn('font-mono text-xs leading-normal', className)}>
      <div className="truncate">
        <span className="text-ms-text-faint">{scheme}</span>
        <span className="text-ms-text">{rest}</span>
      </div>
      <div className="text-ms-text-faint">mailsink {version}</div>
    </div>
  )
}
