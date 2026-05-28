package pics.dsg.openclaw

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.os.Handler
import android.os.Looper
import android.util.AttributeSet
import android.widget.FrameLayout
import android.widget.TextView
import okhttp3.*
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.util.concurrent.TimeUnit

class DsgStatusOverlay @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : FrameLayout(context, attrs) {

    private val badge = TextView(context).apply {
        text = "DSG"
        textSize = 11f
        typeface = Typeface.MONOSPACE
        setTextColor(Color.WHITE)
        setPadding(20, 10, 20, 10)
        setBackgroundColor(Color.parseColor("#607D8B"))
    }

    private val handler = Handler(Looper.getMainLooper())
    private var sseCall: Call? = null

    init {
        addView(badge)
    }

    fun startListening() {
        val client = OkHttpClient.Builder()
            .readTimeout(0, TimeUnit.MILLISECONDS)
            .build()

        val request = Request.Builder()
            .url("${OpenClawWebView.SERVER_URL}/api/dsg-events")
            .build()

        sseCall = client.newCall(request)
        sseCall!!.enqueue(object : Callback {
            override fun onFailure(call: Call, e: java.io.IOException) {}
            override fun onResponse(call: Call, response: Response) {
                response.body?.byteStream()?.let { stream ->
                    BufferedReader(InputStreamReader(stream)).use { reader ->
                        var line: String?
                        while (reader.readLine().also { line = it } != null) {
                            line?.takeIf { it.startsWith("data:") }?.let {
                                try {
                                    val json = JSONObject(it.removePrefix("data:").trim())
                                    val decision = json.optString("decision", "")
                                    handler.post { updateBadge(decision) }
                                } catch (_: Exception) {}
                            }
                        }
                    }
                }
            }
        })
    }

    private fun updateBadge(decision: String) {
        when (decision.uppercase()) {
            "ALLOW" -> {
                badge.text = "✓ ALLOW"
                badge.setBackgroundColor(Color.parseColor("#4CAF50"))
                handler.postDelayed({ updateBadge("") }, 2_000)
            }
            "BLOCK" -> {
                badge.text = "✗ BLOCK"
                badge.setBackgroundColor(Color.parseColor("#F44336"))
                handler.postDelayed({ updateBadge("") }, 4_000)
            }
            else -> {
                badge.text = "DSG"
                badge.setBackgroundColor(Color.parseColor("#607D8B"))
            }
        }
    }

    fun stop() {
        sseCall?.cancel()
        handler.removeCallbacksAndMessages(null)
    }
}
