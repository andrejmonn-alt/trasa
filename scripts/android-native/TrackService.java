package __PKG__;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

// Фоновый сервис: пока вы едете, держит приложение живым (опрос GPS, уведомления об опоздании и заторах).
public class TrackService extends Service {
    static final String CH = "trasa-live";
    static final int NID = 4711;
    private PowerManager.WakeLock wl;

    static Notification build(Context c, String title, String text) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CH) == null) {
            NotificationChannel ch = new NotificationChannel(CH, "Поездка сейчас", NotificationManager.IMPORTANCE_LOW);
            ch.setShowBadge(false);
            nm.createNotificationChannel(ch);
        }
        Intent open = c.getPackageManager().getLaunchIntentForPackage(c.getPackageName());
        PendingIntent pi = PendingIntent.getActivity(c, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, CH) : new Notification.Builder(c);
        return b.setContentTitle(title).setContentText(text)
                .setStyle(new Notification.BigTextStyle().bigText(text))
                .setSmallIcon(c.getApplicationInfo().icon)
                .setOngoing(true).setOnlyAlertOnce(true).setContentIntent(pi).build();
    }

    @Override public int onStartCommand(Intent i, int flags, int startId) {
        String title = i != null && i.getStringExtra("title") != null ? i.getStringExtra("title") : "Trasa следит за поездкой";
        String text = i != null && i.getStringExtra("text") != null ? i.getStringExtra("text") : "";
        Notification n = build(this, title, text);
        if (Build.VERSION.SDK_INT >= 29) startForeground(NID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
        else startForeground(NID, n);
        if (wl == null) {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            wl = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "trasa:live");
            wl.acquire(4 * 60 * 60 * 1000L); // не дольше 4 часов
        }
        return START_NOT_STICKY;
    }

    @Override public void onDestroy() {
        if (wl != null && wl.isHeld()) wl.release();
        wl = null;
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent i) { return null; }
}
