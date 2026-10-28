# Khoá ký APK cho TV box

`debug.keystore` — khoá debug cố định (mật khẩu `android`, alias `androiddebugkey`, như khoá debug
mặc định của Android). Actions chép nó vào `~/.android/debug.keystore` trước khi build app Kho phim và
launcher, nên mọi bản build cùng một chữ ký: bản mới cài đè bản cũ (`adb install -r`) được.

Trước đây mỗi lần Actions chạy tự tạo khoá debug mới → bản sau không cài đè được bản trước, phải gỡ
app rồi cài lại — với launcher đang làm màn hình chính thì gỡ ra là box mất Home.

Khoá nằm công khai: ai có nó cũng ký được APK cùng tên gói, nhưng muốn cài lên box vẫn phải có adb
vào box (gỡ lỗi qua Wi-Fi đã ghép nối). Hai app chỉ xin quyền INTERNET (launcher thêm quyền của launcher).
