package __PKG__;

import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "Tracker")
public class TrackerPlugin extends Plugin {
    private boolean running = false;

    @PluginMethod public void start(PluginCall call) {
        Context c = getContext();
        Intent i = new Intent(c, TrackService.class);
        i.putExtra("title", call.getString("title", "Trasa следит за поездкой"));
        i.putExtra("text", call.getString("text", ""));
        try {
            if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i); else c.startService(i);
            running = true;
            call.resolve();
        } catch (Exception e) { call.reject(e.getMessage()); }
    }

    @PluginMethod public void update(PluginCall call) {
        if (!running) { start(call); return; }
        NotificationManager nm = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        nm.notify(TrackService.NID, TrackService.build(getContext(), call.getString("title", "Trasa"), call.getString("text", "")));
        call.resolve();
    }

    @PluginMethod public void stop(PluginCall call) {
        getContext().stopService(new Intent(getContext(), TrackService.class));
        running = false;
        call.resolve();
    }
}
