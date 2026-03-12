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

public class UpNextWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId);
        }
    }

    static void updateWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_upnext);

        SharedPreferences prefs = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        String raw = prefs.getString("widget_data", null);

        int[] nameIds = {
            R.id.widget_upnext_name_1,
            R.id.widget_upnext_name_2,
            R.id.widget_upnext_name_3
        };
        int[] typeIds = {
            R.id.widget_upnext_type_1,
            R.id.widget_upnext_type_2,
            R.id.widget_upnext_type_3
        };
        int[] rowIds = {
            R.id.widget_upnext_row_1,
            R.id.widget_upnext_row_2,
            R.id.widget_upnext_row_3
        };

        try {
            if (raw != null) {
                JSONObject data = new JSONObject(raw);
                JSONArray upNext = data.optJSONArray("upNext");

                for (int i = 0; i < 3; i++) {
                    if (upNext != null && i < upNext.length()) {
                        JSONObject item = upNext.getJSONObject(i);
                        views.setTextViewText(nameIds[i], item.optString("name", ""));
                        String type = item.optString("type", "tv");
                        views.setTextViewText(typeIds[i], type.equals("movie") ? "\uD83C\uDFAC Movie" : "\uD83D\uDCFA TV");
                        views.setViewVisibility(rowIds[i], android.view.View.VISIBLE);
                    } else {
                        views.setViewVisibility(rowIds[i], android.view.View.GONE);
                    }
                }

                int watchlistCount = data.optJSONObject("stats") != null ?
                    data.getJSONObject("stats").optInt("watchlist", 0) : 0;
                views.setTextViewText(R.id.widget_upnext_count,
                    watchlistCount > 3 ? "+" + (watchlistCount - 3) + " more" : "");
            }
        } catch (Exception e) {
            // Defaults are fine
        }

        // Open app on tap → navigate to watchlist
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.putExtra("page", "watchlist");
        PendingIntent pendingIntent = PendingIntent.getActivity(context, 1, intent, PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_upnext_root, pendingIntent);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }
}
