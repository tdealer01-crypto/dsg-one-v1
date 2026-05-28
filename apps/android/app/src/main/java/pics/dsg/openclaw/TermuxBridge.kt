package pics.dsg.openclaw

import android.content.Context
import android.content.Intent
import android.net.Uri

object TermuxBridge {

    private const val TERMUX_PACKAGE = "com.termux"

    fun isInstalled(context: Context): Boolean = try {
        context.packageManager.getPackageInfo(TERMUX_PACKAGE, 0)
        true
    } catch (_: Exception) {
        false
    }

    fun openTermux(context: Context) {
        val intent = context.packageManager
            .getLaunchIntentForPackage(TERMUX_PACKAGE)
            ?: Intent(Intent.ACTION_VIEW, Uri.parse("https://f-droid.org/packages/com.termux/"))
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
    }
}
