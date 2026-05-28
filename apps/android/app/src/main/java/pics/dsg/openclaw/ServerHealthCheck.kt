package pics.dsg.openclaw

import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit

class ServerHealthCheck {

    private val client = OkHttpClient.Builder()
        .connectTimeout(2, TimeUnit.SECONDS)
        .readTimeout(2, TimeUnit.SECONDS)
        .build()

    fun check(callback: (Boolean) -> Unit) {
        Thread {
            val alive = try {
                val req = Request.Builder()
                    .url("${OpenClawWebView.SERVER_URL}/health")
                    .build()
                client.newCall(req).execute().use { it.isSuccessful }
            } catch (_: Exception) {
                false
            }
            callback(alive)
        }.start()
    }
}
