export default function DangTai() {
  return (
    <div className="mx-auto flex max-w-[1400px] animate-pulse flex-col gap-6 px-4 py-8 md:flex-row md:py-10">
      <div className="aspect-[2/3] w-40 shrink-0 self-center rounded-lg bg-[var(--color-nen-2)] md:w-56 md:self-start" />
      <div className="min-w-0 flex-1 space-y-3">
        <div className="h-9 w-2/3 rounded bg-[var(--color-nen-2)]" />
        <div className="h-4 w-1/3 rounded bg-[var(--color-nen-2)]" />
        <div className="h-24 w-full max-w-3xl rounded bg-[var(--color-nen-2)]" />
        <div className="h-10 w-48 rounded bg-[var(--color-nen-2)]" />
      </div>
    </div>
  )
}
