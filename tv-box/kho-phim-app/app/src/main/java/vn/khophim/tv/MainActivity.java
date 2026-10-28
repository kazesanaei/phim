package vn.khophim.tv;

import android.app.Activity;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

/**
 * Một màn WebView toàn màn hình mở máy chủ phim chạy ngay trên box (Termux, xem tv-box/cai-tren-box.sh).
 *
 * Ba việc trình duyệt thường làm không tốt trên TV mà ở đây phải tự lo:
 *  - máy chủ chưa lên (vừa bật box, Termux:Boot cần ~15 giây): báo đang chờ và tự thử lại, không hiện trang lỗi;
 *  - toàn màn hình của trình phát (Fullscreen API) cần WebChromeClient.onShowCustomView, không thì nút phóng to chết;
 *  - nút Back: đưa cho trang xử lý trước (xem dispatchKeyEvent), trang bỏ qua mới thoát app.
 */
public class MainActivity extends Activity {
    private static final String GOC = "http://127.0.0.1:3000";
    private static final long THU_LAI_MS = 3000;

    private WebView web;
    private FrameLayout khung;
    private View manToanCanh;
    private WebChromeClient.CustomViewCallback dongToanCanh;
    private final Handler hen = new Handler(Looper.getMainLooper());
    private final Runnable thuLai = () -> web.loadUrl(GOC);

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        // Đang xem phim mà màn hình chờ bật lên là hỏng cả buổi; app này chỉ để xem phim.
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        // Cho DevTools đo hiệu năng qua adb (adb vốn đã toàn quyền với box, không mở thêm cửa nào).
        WebView.setWebContentsDebuggingEnabled(true);

        khung = new FrameLayout(this);
        web = new WebView(this);
        khung.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(khung);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setTextZoom(100);
        s.setUserAgentString(s.getUserAgentString() + " KhoPhimTV");

        CookieManager cm = CookieManager.getInstance();
        cm.setAcceptCookie(true);
        // Mở lần đầu thì vào thẳng giao diện TV. Đã có lựa chọn (kể cả "pc") thì để nguyên.
        String c = cm.getCookie(GOC);
        if (c == null || !c.contains("che-do=")) {
            cm.setCookie(GOC, "che-do=tv; path=/; max-age=31536000");
        }

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                return false; // mọi liên kết mở ngay trong app
            }

            @Override
            public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) {
                if (!r.isForMainFrame()) return;
                v.loadDataWithBaseURL(null, CHO, "text/html", "utf-8", null);
                hen.removeCallbacks(thuLai);
                hen.postDelayed(thuLai, THU_LAI_MS);
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onShowCustomView(View v, CustomViewCallback cb) {
                if (manToanCanh != null) {
                    cb.onCustomViewHidden();
                    return;
                }
                manToanCanh = v;
                dongToanCanh = cb;
                khung.addView(v, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
                web.setVisibility(View.GONE);
            }

            @Override
            public void onHideCustomView() {
                if (manToanCanh == null) return;
                khung.removeView(manToanCanh);
                manToanCanh = null;
                web.setVisibility(View.VISIBLE);
                if (dongToanCanh != null) dongToanCanh.onCustomViewHidden();
                dongToanCanh = null;
            }
        });

        if (saved != null) web.restoreState(saved);
        else web.loadUrl(GOC);
    }

    /**
     * Back của remote: hỏi TRANG trước. Trang (PhimRemote, trình phát, menu, hộp thoại) có việc cho Back —
     * đóng bảng cài đặt, ẩn thanh điều khiển, lùi một trang — thì nó preventDefault. Trang bỏ qua (đang ở
     * trang chủ) mới thoát app. Trước đây app tự goBack() ngay, nên đang xem phim bấm Back là văng khỏi
     * trang xem, không đóng nổi bảng cài đặt.
     */
    @Override
    public boolean dispatchKeyEvent(KeyEvent e) {
        if (e.getKeyCode() != KeyEvent.KEYCODE_BACK) return super.dispatchKeyEvent(e);
        if (e.getAction() != KeyEvent.ACTION_UP) return true;
        if (manToanCanh != null) {
            web.getWebChromeClient().onHideCustomView();
            return true;
        }
        web.evaluateJavascript(HOI_BACK, kq -> {
            if (!"true".equals(kq)) finish();
        });
        return true;
    }

    private static final String HOI_BACK = "(function(){var e=new KeyboardEvent('keydown',{key:'Escape',code:'Escape',"
            + "bubbles:true,cancelable:true});(document.activeElement||document.body).dispatchEvent(e);return e.defaultPrevented})()";

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onPause() {
        super.onPause();
        CookieManager.getInstance().flush();
    }

    @Override
    protected void onDestroy() {
        hen.removeCallbacks(thuLai);
        web.destroy();
        super.onDestroy();
    }

    private static final String CHO = "<!doctype html><meta charset=utf-8><body style=\"margin:0;height:100vh;display:grid;place-items:center;"
            + "background:#0b0b0f;color:#ededed;font:600 28px system-ui,sans-serif;text-align:center\">"
            + "<div>Đang chờ máy chủ phim khởi động…<div style=\"margin-top:12px;font-size:18px;opacity:.55\">"
            + "Vừa bật box thì mất khoảng 15 giây. Trang tự mở khi sẵn sàng.</div></div>";
}
