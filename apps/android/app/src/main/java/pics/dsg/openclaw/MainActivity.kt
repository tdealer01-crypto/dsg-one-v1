package pics.dsg.openclaw

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.View
import android.widget.FrameLayout
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    private val healthCheck = ServerHealthCheck()
    private val handler = Handler(Looper.getMainLooper())
    private lateinit var root: FrameLayout
    private lateinit var dsgOverlay: DsgStatusOverlay
    private var openClawWebView: OpenClawWebView? = null
    private var wizardLaunched = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        root = FrameLayout(this)
        setContentView(root)

        dsgOverlay = DsgStatusOverlay(this)
        val overlayParams = FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.WRAP_CONTENT,
            FrameLayout.LayoutParams.WRAP_CONTENT,
            Gravity.TOP or Gravity.END
        ).apply {
            topMargin = 56
            rightMargin = 24
        }
        root.addView(dsgOverlay, overlayParams)
        dsgOverlay.visibility = View.GONE

        startHealthPolling()
    }

    private fun startHealthPolling() {
        handler.post(object : Runnable {
            override fun run() {
                healthCheck.check { isAlive ->
                    runOnUiThread {
                        if (isAlive) showWebView()
                        else if (!wizardLaunched) showSetupWizard()
                    }
                }
                handler.postDelayed(this, 3_000)
            }
        })
    }

    private fun showWebView() {
        if (openClawWebView != null) return
        val wv = OpenClawWebView(this)
        openClawWebView = wv
        root.addView(wv, 0, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ))
        dsgOverlay.visibility = View.VISIBLE
        dsgOverlay.startListening()
    }

    private fun showSetupWizard() {
        wizardLaunched = true
        startActivity(Intent(this, SetupWizardActivity::class.java))
    }

    override fun onDestroy() {
        super.onDestroy()
        handler.removeCallbacksAndMessages(null)
        dsgOverlay.stop()
    }
}
