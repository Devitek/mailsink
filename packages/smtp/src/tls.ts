import { readFile } from 'node:fs/promises'

/** `MAILSINK_SMTP_TLS_CERT` / `MAILSINK_SMTP_TLS_KEY`: paths of PEM files. */
export interface SmtpTlsFiles {
  certPath: string
  keyPath: string
}

/**
 * Reads the STARTTLS certificate and key at boot. A missing or unreadable file fails the
 * boot (D28); the error names the variable, never the content.
 */
export async function readTlsFiles(files: SmtpTlsFiles): Promise<{ cert: Buffer; key: Buffer }> {
  const read = (path: string, variable: string) =>
    readFile(path).catch((error: NodeJS.ErrnoException) => {
      throw new Error(`${variable}: cannot read ${path} (${error.code ?? error.message})`)
    })
  const [cert, key] = await Promise.all([
    read(files.certPath, 'MAILSINK_SMTP_TLS_CERT'),
    read(files.keyPath, 'MAILSINK_SMTP_TLS_KEY'),
  ])
  return { cert, key }
}
