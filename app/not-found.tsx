import Trong from '@/components/Trong'

export default function KhongThay() {
  return (
    <Trong
      hinh="tim"
      tieuDe="Không có trang này"
      moTa="Phim có thể đã bị nguồn gỡ, hoặc đường dẫn gõ sai."
      nut={[
        { nhan: 'Về trang chủ', href: '/', chinh: true },
        { nhan: 'Tìm phim khác', href: '/tim-kiem' },
      ]}
    />
  )
}
