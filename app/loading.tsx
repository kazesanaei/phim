import ThanhTai from '@/components/ThanhTai'
import { HangKhung } from '@/components/Khung'

export default function DangTai() {
  return (
    <div className="pb-10">
      <ThanhTai />
      <div className="min-h-[46vh] w-full animate-pulse bg-[var(--color-nen-2)] md:min-h-[62vh]" />
      <div className="mx-auto max-w-[1600px]">
        <HangKhung />
        <HangKhung />
        <HangKhung />
      </div>
    </div>
  )
}
