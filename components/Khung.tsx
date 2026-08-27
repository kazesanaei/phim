/** Các mảnh khung xương (skeleton) dùng cho loading.tsx — thuần tĩnh, không state. */

export function TheKhung() {
  return (
    <div className="animate-pulse">
      <div className="aspect-[2/3] w-full rounded-lg bg-[var(--color-nen-2)]" />
      <div className="mt-1.5 h-3 w-4/5 rounded bg-[var(--color-nen-2)]" />
      <div className="mt-1 h-2.5 w-1/2 rounded bg-[var(--color-nen-2)]" />
    </div>
  )
}

export function LuoiKhung({ so = 16 }: { so?: number }) {
  return (
    <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
      {Array.from({ length: so }).map((_, i) => (
        <TheKhung key={i} />
      ))}
    </div>
  )
}

export function HangKhung({ so = 8 }: { so?: number }) {
  return (
    <section className="py-3">
      <div className="mb-2 h-4 w-40 rounded bg-[var(--color-nen-2)] px-4" />
      <div className="flex gap-3 overflow-hidden px-4">
        {Array.from({ length: so }).map((_, i) => (
          <div key={i} className="w-32 shrink-0 sm:w-36 md:w-40">
            <TheKhung />
          </div>
        ))}
      </div>
    </section>
  )
}
