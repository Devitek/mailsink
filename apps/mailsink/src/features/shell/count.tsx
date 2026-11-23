// Mono count next to a tab, segment or chip label (0 while unknown).
export function Count({ value }: Readonly<{ value: number | undefined }>) {
  return <span className="font-mono text-badge text-ms-text-faint">{value ?? 0}</span>
}
