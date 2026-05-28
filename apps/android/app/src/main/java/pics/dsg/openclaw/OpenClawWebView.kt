package pics.dsg.openclaw

import android.annotation.SuppressLint
import android.content.Context
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView

@SuppressLint("SetJavaScriptEnabled")
class OpenClawWebView(context: Context) : WebView(context) {

    companion object {
        const val SERVER_URL = "http://localhost:3000"
    }

    init {
        with(settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            allowContentAccess = true
            allowFileAccess = true
            cacheMode = WebSettings.LOAD_DEFAULT
        }
        webChromeClient = WebChromeClient()
        loadUrl(SERVER_URL)
    }
}
