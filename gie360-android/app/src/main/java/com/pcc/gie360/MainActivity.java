package com.pcc.gie360;

import android.annotation.SuppressLint;
import android.graphics.Color;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebChromeClient;
import android.webkit.ValueCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.splashscreen.SplashScreen;

public class MainActivity extends AppCompatActivity {
    private WebView webView;
    private ValueCallback<Uri[]> uploadCallback;
    private final ActivityResultLauncher<Intent> chooseImport = registerForActivityResult(
        new ActivityResultContracts.StartActivityForResult(), result -> {
            if (uploadCallback == null) return;
            Uri uri = result.getResultCode() == RESULT_OK && result.getData() != null
                ? result.getData().getData() : null;
            // Only system document-provider URIs may be uploaded; no file:// paths.
            uploadCallback.onReceiveValue(uri != null && "content".equals(uri.getScheme()) ? new Uri[]{uri} : null);
            uploadCallback = null;
        });

    @SuppressLint("SetJavaScriptEnabled")
    @Override public void onCreate(Bundle state) {
        SplashScreen.installSplashScreen(this);
        super.onCreate(state);
        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(248, 246, 240));
        setContentView(webView);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportMultipleWindows(false);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                                       FileChooserParams params) {
                if (uploadCallback != null) uploadCallback.onReceiveValue(null);
                uploadCallback = callback;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{
                    "text/csv", "application/csv", "application/vnd.ms-excel",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                });
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                try { chooseImport.launch(intent); }
                catch (android.content.ActivityNotFoundException exception) {
                    uploadCallback.onReceiveValue(null);
                    uploadCallback = null;
                }
                return true;
            }
        });
        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !NavigationPolicy.permits(BuildConfig.GIE360_URL, request.getUrl().toString());
            }
            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                if (!NavigationPolicy.permits(BuildConfig.GIE360_URL, url)) {
                    view.stopLoading();
                    view.loadUrl(BuildConfig.GIE360_URL);
                }
            }
        });
        // Do not restore a potentially obsolete administrative URL from saved WebView state.
        webView.loadUrl(BuildConfig.GIE360_URL);
    }

    @Override public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override protected void onDestroy() {
        if (uploadCallback != null) { uploadCallback.onReceiveValue(null); uploadCallback = null; }
        if (webView != null) { webView.destroy(); webView = null; }
        super.onDestroy();
    }
}
