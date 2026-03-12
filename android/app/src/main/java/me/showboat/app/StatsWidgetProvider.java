package me.showboat.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

import org.json.JSONObject;

public class StatsWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId);
        }
    }

    static void updateWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_stats);

        // Read widget data from Capacitor Preferences (shared prefs)
        SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        String raw = prefs.getString("widget_data", null);

        try {
            if (raw != null) {
                JSONObject data = new JSONObject(raw);
                JSONObject stats = data.getJSONObject("stats");

                views.setTextViewText(R.id.widget_stat_episodes, String.valueOf(stats.optInt("episodes", 0)));
                views.setTextViewText(R.id.widget_stat_movies, String.valueOf(stats.optInt("movies", 0)));
                views.setTextViewText(R.id.widget_stat_shows, String.valueOf(stats.optInt("shows", 0)));
                views.setTextViewText(R.id.widget_stat_ratings, String.valueOf(stats.optInt("ratings", 0)));
                views.setTextViewText(R.id.widget_stat_watchlist, String.valueOf(stats.optInt("watchlist", 0)));
                views.setTextViewText(R.id.widget_stat_friends, String.valueOf(stats.optInt("friends", 0)));

                String name = data.optString("displayName", "ShowBoat");
                views.setTextViewText(R.id.widget_user_name, name);

                int streak = data.optInt("streak", 0);
                views.setTextViewText(R.id.widget_streak, streak > 0 ? streak + " day streak \uD83D\uDD25" : "");
            }
        } catch (Exception e) {
            // Defaults are fine
        }

        // Open app on tap
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_stats_root, pendingIntent);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }
}
