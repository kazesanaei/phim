import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import path from 'node:path'

const DUONG_DAN_DB = path.join(process.cwd(), 'du-lieu', 'phim.db')

const LUOC_DO = `
create table if not exists nguon_thu_muc (
  id integer primary key autoincrement,
  duong_dan text not null unique,
  bat integer not null default 1,
  la_thu_muc_tai integer not null default 0,
  them_luc text not null default (datetime('now'))
);

create table if not exists phim (
  id integer primary key autoincrement,
  nguon text not null default 'local',
  slug text not null unique,
  ten text not null,
  ten_goc text,
  nam integer,
  loai text not null default 'le',
  poster text,
  backdrop text,
  mo_ta text,
  thoi_luong integer,
  chat_luong text,
  ngon_ngu text,
  tmdb_id text,
  thu_muc text,
  ten_khong_dau text,
  sua_tay integer not null default 0,
  tao_luc text not null default (datetime('now'))
);

create table if not exists tap (
  id integer primary key autoincrement,
  phim_id integer not null references phim(id) on delete cascade,
  so_tap integer not null default 1,
  ten text,
  duong_dan_file text,
  embed text,
  thoi_luong real,
  codec_v text,
  codec_a text,
  can_chuyen_ma integer not null default 0,
  -- JSON danh sách luồng tiếng / phụ đề nhúng đọc bằng ffprobe
  luong text
);
create index if not exists idx_tap_phim on tap(phim_id);

create table if not exists phu_de (
  id integer primary key autoincrement,
  tap_id integer not null references tap(id) on delete cascade,
  ngon_ngu text,
  nhan text,
  duong_dan text not null,
  mac_dinh integer not null default 0
);
create index if not exists idx_phude_tap on phu_de(tap_id);

create table if not exists the_loai (
  phim_id integer not null references phim(id) on delete cascade,
  ten text not null,
  slug text not null,
  primary key (phim_id, slug)
);

create table if not exists quoc_gia (
  phim_id integer not null references phim(id) on delete cascade,
  ten text not null,
  slug text not null,
  primary key (phim_id, slug)
);

create table if not exists tai_ve (
  id integer primary key autoincrement,
  phim_slug text not null,
  tap_slug text not null,
  ten_hien text not null,
  embed text not null,
  poster text,
  trang_thai text not null default 'cho',
  phan_tram real not null default 0,
  duong_dan_ra text,
  loi text,
  tao_luc text not null default (datetime('now')),
  unique (phim_slug, tap_slug)
);

create table if not exists xem (
  khoa text primary key,
  slug text not null,
  tap text,
  ten text,
  poster text,
  nguon text not null default 'vsmov',
  vi_tri real not null default 0,
  thoi_luong real not null default 0,
  xong integer not null default 0,
  cap_nhat text not null default (datetime('now'))
);

create table if not exists danh_dau (
  khoa text not null,
  loai text not null,
  ten text,
  poster text,
  nam integer,
  nguon text not null default 'vsmov',
  tao_luc text not null default (datetime('now')),
  primary key (khoa, loai)
);

create table if not exists cai_dat (
  khoa text primary key,
  gia_tri text
);

-- Mốc intro đánh dấu tay, dùng chung cho mọi tập của cùng một phim/phần.
-- Không tự dò bằng phân tích âm thanh: tốn hàng phút CPU mỗi tập, trong khi
-- bấm một phím đúng một lần là xong cho cả bộ.
create table if not exists moc_intro (
  phim_slug text primary key,
  bat_dau real not null,
  ket_thuc real not null,
  cap_nhat text not null default (datetime('now'))
);

-- Phim bộ đang theo dõi: nhớ số tập lúc đánh dấu để biết khi nào có tập mới.
create table if not exists theo_doi (
  slug text primary key,
  ten text,
  poster text,
  tap_da_biet text,
  tap_moi integer not null default 0,
  kiem_luc text,
  tao_luc text not null default (datetime('now'))
);

-- KHO ĐỆM METADATA từ nguồn.
-- Quét theo TỪNG THỂ LOẠI: mỗi trang vừa cho dữ liệu phim vừa cho biết phim đó
-- thuộc thể loại nào — endpoint danh sách không trả thể loại, mà gọi endpoint
-- chi tiết cho 18k phim thì bất khả thi.
-- Có kho này thì làm được thứ nguồn KHÔNG hỗ trợ: sắp xếp theo điểm/năm, lọc
-- nhiều thể loại cùng lúc, và gom phần triệt để trên toàn bộ danh mục.
create table if not exists kho_phim (
  slug text primary key,
  ten text not null,
  ten_goc text,
  nam integer,
  poster text,
  anh_ngang text,
  loai text,
  chat_luong text,
  tap_hien_tai text,
  diem real,
  so_phieu integer not null default 0,
  ten_khong_dau text,
  goc_ten text,
  goc_khong_dau text,
  so_phan integer,
  cap_nhat text not null default (datetime('now'))
);
create index if not exists idx_kho_diem on kho_phim(diem desc);
create index if not exists idx_kho_nam on kho_phim(nam desc);
create index if not exists idx_kho_goc on kho_phim(goc_khong_dau);

create table if not exists kho_the_loai (
  slug_phim text not null,
  slug_the_loai text not null,
  primary key (slug_phim, slug_the_loai)
);
create index if not exists idx_kho_tl on kho_the_loai(slug_the_loai);

-- Sổ đen 18+: quét một lần thể loại người lớn của nguồn rồi chặn theo slug.
-- Cần sổ đen vì endpoint danh sách KHÔNG trả thể loại, không lọc tại chỗ được.
create table if not exists chan_18 (
  slug text primary key,
  ly_do text,
  tao_luc text not null default (datetime('now'))
);

-- Nguồn nào có phim nào. Một phim (theo slug) có thể nằm ở nhiều nguồn; trang
-- chi tiết gộp chúng thành nhiều "server" để đổi qua lại khi một bên chết.
create table if not exists kho_nguon_phim (
  slug text not null,
  nguon text not null,
  primary key (slug, nguon)
);
create index if not exists idx_knp_nguon on kho_nguon_phim(nguon);

-- Chỉ mục diễn viên / đạo diễn.
-- BẮT BUỘC phải tự dựng: không nguồn nào tìm được theo tên người. Đã thử
-- /dien-vien/<slug> (404) và /tim-kiem?actor= (422); ?keyword= chỉ khớp TÊN PHIM.
-- Tên người chỉ có ở endpoint chi tiết từng phim, nên phải quét (lib/quet-nguoi.ts).
create table if not exists nguoi_phim (
  slug_phim text not null,
  ten text not null,
  khong_dau text not null,
  loai text not null default 'dv',   -- 'dv' diễn viên, 'dd' đạo diễn
  primary key (slug_phim, ten, loai)
);
create index if not exists idx_np_khong_dau on nguoi_phim(khong_dau);
create index if not exists idx_np_phim on nguoi_phim(slug_phim);

-- Phim nào đã lấy xong danh sách người, để quét lại không phải gọi lại từ đầu.
create table if not exists nguoi_da_quet (
  slug_phim text primary key,
  so_nguoi integer not null default 0,
  quet_luc text not null default (datetime('now'))
);
`

/**
 * Cột thêm sau này. `create table if not exists` KHÔNG đụng tới bảng đã có, nên
 * DB cũ sẽ thiếu cột mới và truy vấn ném lỗi. Thêm tay, bỏ qua nếu đã có.
 */
const COT_THEM: [string, string][] = [['tap', 'luong text']]

function nangCap(db: DatabaseSync) {
  for (const [bang, khaiBao] of COT_THEM) {
    try {
      db.exec(`alter table ${bang} add column ${khaiBao}`)
    } catch {
      // đã có cột rồi
    }
  }
}

function moDb(): DatabaseSync {
  // turbopackIgnore: đường dẫn dựng từ process.cwd() nên Turbopack coi là "truy
  // cập tệp động" và đi truy vết CẢ dự án — kể cả vài GB .mp4 trong upload/.
  // Đây là mắt xích middleware -> lib/xac-thuc -> lib/db làm build chết.
  mkdirSync(/* turbopackIgnore: true */ path.dirname(DUONG_DAN_DB), { recursive: true })
  const db = new DatabaseSync(DUONG_DAN_DB)
  /**
   * PHẢI LÀ CÂU ĐẦU TIÊN, trước cả `journal_mode`.
   *
   * `next build` chạy 15 tiến trình con song song, mỗi cái import tệp này và
   * cùng lúc đụng vào một tệp SQLite → "database is locked", build gãy ở khâu
   * thu thập cấu hình route. Đã gặp thật hai lần, và chính nó là thủ phạm của
   * lần "Failed to collect page data" tưởng là do thiếu tệp DB.
   *
   * Đặt sau `journal_mode = wal` là vô dụng: chuyển journal mode cần lấy khoá
   * độc quyền, nên nó mới là câu chết trước — đúng dòng báo lỗi lần thứ hai.
   * Không có pragma này thì SQLite bỏ cuộc ngay thay vì chờ tới lượt.
   */
  db.exec('pragma busy_timeout = 10000')
  db.exec('pragma journal_mode = wal')
  db.exec('pragma foreign_keys = on')
  db.exec(LUOC_DO)
  nangCap(db)
  return db
}

// Giữ một kết nối duy nhất qua các lần hot-reload của Next dev.
const kho = globalThis as unknown as { __phimDb?: DatabaseSync }
export const db: DatabaseSync = kho.__phimDb ?? (kho.__phimDb = moDb())

export function layCaiDat(khoa: string, macDinh = ''): string {
  const d = db.prepare('select gia_tri from cai_dat where khoa = ?').get(khoa) as { gia_tri?: string } | undefined
  return d?.gia_tri ?? macDinh
}

export function datCaiDat(khoa: string, giaTri: string) {
  db.prepare('insert into cai_dat (khoa, gia_tri) values (?, ?) on conflict(khoa) do update set gia_tri = excluded.gia_tri').run(khoa, giaTri)
}

export function thuMucNguon(chiBat = true): { id: number; duong_dan: string; bat: number; la_thu_muc_tai: number }[] {
  const sql = chiBat
    ? 'select * from nguon_thu_muc where bat = 1 order by id'
    : 'select * from nguon_thu_muc order by id'
  return db.prepare(sql).all() as never
}
