package pics.dsg.openclaw

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.text.Html
import android.text.method.LinkMovementMethod
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class SetupWizardActivity : AppCompatActivity() {

    private val SETUP_SCRIPT_URL =
        "https://raw.githubusercontent.com/tdealer01-crypto/dsg-one-v1/main/scripts/openclaw-termux-setup.sh"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(56, 80, 56, 56)
        }

        layout.addView(TextView(this).apply {
            text = "DSG OpenClaw"
            textSize = 26f
            setPadding(0, 0, 0, 8)
        })

        layout.addView(TextView(this).apply {
            text = "Setup"
            textSize = 14f
            alpha = 0.6f
            setPadding(0, 0, 0, 40)
        })

        val stepsHtml = """
            <b>1.</b> ติดตั้ง <b>Termux</b> จาก F-Droid<br/>
            &nbsp;&nbsp;<small><a href="https://f-droid.org/packages/com.termux/">f-droid.org/packages/com.termux</a></small><br/><br/>
            <b>2.</b> ติดตั้ง <b>Termux:Boot</b> (auto-start)<br/>
            &nbsp;&nbsp;<small><a href="https://f-droid.org/packages/com.termux.boot/">f-droid.org/packages/com.termux.boot</a></small><br/><br/>
            <b>3.</b> เปิด Termux แล้วรัน:<br/>
            &nbsp;&nbsp;<tt>curl -fsSL $SETUP_SCRIPT_URL | bash</tt><br/><br/>
            <b>4.</b> ใส่ API keys ที่ <tt>~/openclaw/.env</tt><br/><br/>
            <b>5.</b> รัน <tt>cd ~/openclaw &amp;&amp; pnpm start</tt><br/><br/>
            <b>6.</b> กลับมาที่แอปนี้ — จะเชื่อมต่ออัตโนมัติ
        """.trimIndent()

        layout.addView(TextView(this).apply {
            text = Html.fromHtml(stepsHtml, Html.FROM_HTML_MODE_COMPACT)
            textSize = 14f
            movementMethod = LinkMovementMethod.getInstance()
            setPadding(0, 0, 0, 40)
        })

        layout.addView(Button(this).apply {
            text = if (TermuxBridge.isInstalled(this@SetupWizardActivity))
                "เปิด Termux" else "ดาวน์โหลด Termux (F-Droid)"
            setOnClickListener {
                if (TermuxBridge.isInstalled(this@SetupWizardActivity)) {
                    TermuxBridge.openTermux(this@SetupWizardActivity)
                } else {
                    startActivity(Intent(Intent.ACTION_VIEW,
                        Uri.parse("https://f-droid.org/packages/com.termux/")))
                }
            }
        })
    }
}
