package me.showboat.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

public class RecentWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId);
        }
    }

    static void updateWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_recent);

        SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        String raw = prefs.getString("widget_data", null);

        int[] nameIds = {
            R.id.widget_recent_name_1,
            R.id.widget_recent_name_2,
            R.id.widget_recent_name_3
        };
        int[] scoreIds = {
            R.id.widget_recent_score_1,
            R.id.widget_recent_score_2,
            R.id.widget_recent_score_3
        };
        int[] rowIds = {
            R.id.widget_recent_row_1,
            R.id.widget_recent_row_2,
            R.id.widget_recent_row_3
        };

        try {
            if (raw != null) {
                JSONObject data = new JSONObject(raw);
                JSONArray ratings = data.optJSONArray("recentRatings");

                views.setTextViewText(R.id.widget_recent_user, data.optString("displayName", ""));

                for (int i = 0; i < 3; i++) {
                    if (ratings != null && i < ratings.length()) {
                        JSONObject item = ratings.getJSONObject(i);
                        views.setTextViewText(nameIds[i], item.optString("name", ""));
                        double score = item.optDouble("score", 0);
                        views.setTextViewText(scoreIds[i], formatScore(score));
                        views.setViewVisibility(rowIds[i], android.view.View.VISIBLE);
                    } else {
                        views.setViewVisibility(rowIds[i], android.view.View.GONE);
                    }
                }
            }
        } catch (Exception e) {
            // Defaults
        }

        // Open app on tap → navigate to profile
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.putExtra("page", "profile");
        PendingIntent pendingIntent = PendingIntent.getActivity(context, 2, intent, PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_recent_root, pendingIntent);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    private static String formatScore(double score) {
        if (score <= 0) return "—";
        // Star display: ★★★★☆ style
        int full = (int) score;
        boolean half = (score - full) >= 0.5;
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < full && i < 5; i++) sb.append("★");
        if (half && full < 5) sb.append("½");
        return sb.toString() + " " + String.format("%.1f", score);
    }
}
