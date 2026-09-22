package de.lemaproyal.fitness;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.provider.MediaStore;
import android.webkit.WebView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.webkit.JavaScriptReplyProxy;
import androidx.webkit.WebMessageCompat;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;

/**
 * Nimmt Dateien aus der Web-App entgegen (src/datei.js) und legt sie im
 * Download-Ordner des Handys ab. Nötig, weil die WebView die Blob-Downloads,
 * mit denen die Web-App im Browser exportiert, nicht ausführen kann.
 *
 * In der Web-App erscheint die Brücke als `window.FitnessAndroid` – und zwar nur
 * auf der eigenen Adresse, nicht in eingebetteten Seiten wie dem YouTube-Player.
 */
final class DateiBruecke implements WebViewCompat.WebMessageListener {

    private static final String NAME_IM_BROWSER = "FitnessAndroid";

    private final Context context;

    private DateiBruecke(Context context) {
        this.context = context;
    }

    static void anmelden(WebView webView, Context context) {
        // Seit Android-WebView 2021 vorhanden, das über den Play Store aktualisiert wird.
        // Fehlt die Funktion trotzdem, bleibt nur der Export ohne Wirkung.
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return;
        WebViewCompat.addWebMessageListener(webView, NAME_IM_BROWSER,
                Collections.singleton("https://" + MainActivity.APP_HOST), new DateiBruecke(context));
    }

    @Override
    public void onPostMessage(@NonNull WebView ansicht, @NonNull WebMessageCompat nachricht,
                              @NonNull Uri herkunft, boolean istHauptseite,
                              @NonNull JavaScriptReplyProxy antwort) {
        if (!istHauptseite || nachricht.getData() == null) return;
        try {
            JSONObject auftrag = new JSONObject(nachricht.getData());
            if (!"dateiSpeichern".equals(auftrag.optString("aktion"))) return;
            String name = inDownloadsSpeichern(
                    auftrag.getString("dateiname"),
                    auftrag.getString("inhalt"),
                    auftrag.optString("typ", "application/octet-stream"));
            melden(context.getString(R.string.gespeichert, name));
        } catch (JSONException | IOException | RuntimeException e) {
            melden(context.getString(R.string.speichern_fehlgeschlagen, e.getMessage()));
        }
    }

    /** Liefert den tatsächlichen Dateinamen – Android hängt bei Namensgleichheit „(1)“ an. */
    private String inDownloadsSpeichern(String dateiname, String inhalt, String typ) throws IOException {
        ContentResolver speicher = context.getContentResolver();
        ContentValues werte = new ContentValues();
        werte.put(MediaStore.Downloads.DISPLAY_NAME, dateiname);
        // Ohne Zusatz wie „;charset=utf-8“ – den versteht der MediaStore nicht als Typ.
        werte.put(MediaStore.Downloads.MIME_TYPE, typ.split(";")[0].trim());
        werte.put(MediaStore.Downloads.IS_PENDING, 1);

        Uri ziel = speicher.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, werte);
        if (ziel == null) throw new IOException("Download-Ordner nicht erreichbar");

        try (OutputStream aus = speicher.openOutputStream(ziel)) {
            if (aus == null) throw new IOException("Datei lässt sich nicht öffnen");
            aus.write(inhalt.getBytes(StandardCharsets.UTF_8));
        } catch (IOException e) {
            speicher.delete(ziel, null, null);
            throw e;
        }

        werte.clear();
        werte.put(MediaStore.Downloads.IS_PENDING, 0);
        speicher.update(ziel, werte, null, null);
        return tatsaechlicherName(speicher, ziel, dateiname);
    }

    private static String tatsaechlicherName(ContentResolver speicher, Uri ziel, String vorgabe) {
        try (Cursor c = speicher.query(ziel, new String[]{MediaStore.Downloads.DISPLAY_NAME},
                null, null, null)) {
            return c != null && c.moveToFirst() ? c.getString(0) : vorgabe;
        }
    }

    private void melden(String text) {
        Toast.makeText(context, text, Toast.LENGTH_LONG).show();
    }
}
