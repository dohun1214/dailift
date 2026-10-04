package expo.modules.restnotification

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val CHANNEL_ID = "rest-live"
private const val NOTIFICATION_ID = 4711

/**
 * 휴식 타이머를 알림창에 띄운다: 남은 시간이 저절로 줄어드는 진행 중 알림.
 * 소리·진동 없이 조용히 떠 있다가 끝나는 시각에 스스로 사라진다(끝났다는 알림은 따로 온다).
 */
class RestNotificationModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("RestNotification")

    // endsAt: 끝나는 시각(ms). url: 알림을 눌렀을 때 열 화면
    Function("show") { endsAt: Double, title: String, body: String, channelName: String, url: String ->
      show(endsAt.toLong(), title, body, channelName, url)
    }

    Function("hide") {
      NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID)
    }
  }

  private fun show(endsAt: Long, title: String, body: String, channelName: String, url: String): Boolean {
    val remaining = endsAt - System.currentTimeMillis()
    val manager = NotificationManagerCompat.from(context)
    if (remaining <= 0) {
      manager.cancel(NOTIFICATION_ID)
      return false
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
      ContextCompat.checkSelfPermission(context, android.Manifest.permission.POST_NOTIFICATIONS) !=
      PackageManager.PERMISSION_GRANTED
    ) {
      return false
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(CHANNEL_ID, channelName, NotificationManager.IMPORTANCE_LOW)
      channel.setShowBadge(false)
      (context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
        .createNotificationChannel(channel)
    }

    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
      setPackage(context.packageName)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    }
    val pending = PendingIntent.getActivity(
      context,
      0,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    // expo-notifications가 만든 알림 아이콘이 있으면 그걸 쓰고, 없으면 앱 아이콘
    val custom = context.resources.getIdentifier("notification_icon", "drawable", context.packageName)
    val icon = if (custom != 0) custom else context.applicationInfo.icon

    val builder = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(icon)
      .setContentTitle(title)
      .setContentIntent(pending)
      .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setAutoCancel(false)
      .setShowWhen(true)
      .setWhen(endsAt)
      .setUsesChronometer(true)
      .setChronometerCountDown(true)
      .setTimeoutAfter(remaining)
    if (body.isNotEmpty()) builder.setContentText(body)

    manager.notify(NOTIFICATION_ID, builder.build())
    return true
  }
}
