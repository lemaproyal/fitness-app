package de.lemaproyal.fitness;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.provider.MediaStore;
import android.webkit.WebView;

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
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Nimmt Dateien aus der Web-App entgegen (src/datei.js) und legt sie im
 * Download-Ordner des Handys ab. Nötig, weil die WebView die Blob-Downloads,
 * mit denen die Web-App im Browser exportiert, kommentarlos verwirft.
 *
 * In der Web-App erscheint die Brücke als `window.FitnessAndroid` – und zwar nur
 * auf der eigenen Adresse, nicht in eingebetteten Seiten wie dem YouTube-Player.
 * Jeder Auftrag bekommt eine Antwort {id, ok, name | fehler}; die Meldung für
 * den Nutzer zeigt die Web-App selbst.
 */
final class DateiBruecke implements WebViewCompat.WebMessageListener {

    private static final String NAME_IM_BROWSER = "FitnessAndroid";
    // Eine Sicherung kann mehrere Megabyte haben – Zerlegen und Schreiben blockierten sonst die Oberfläche.
    // Statisch: Ein Thread für die ganze App, auch wenn Android die Activity neu erzeugt.
    private static final ExecutorService SCHREIBER = Executors.newSingleThreadExecutor();

    private final Context context;

    private DateiBruecke(Context context) {
        this.context = context.getApplicationContext();
    }

    static void anmelden(WebView webView, Context context) {
        // Seit Android-WebView 2020 vorhanden, das über den Play Store aktualisiert wird.
        // Fehlt die Funktion trotzdem, erkennt src/datei.js die WebView ohne Brücke und
        // meldet, dass nicht gespeichert werden kann.
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return;
        WebViewCompat.addWebMessageListener(webView, NAME_IM_BROWSER,
                Collections.singleton("https://" + MainActivity.APP_HOST), new DateiBruecke(context));
    }

    @Override
    public void onPostMessage(@NonNull WebView ansicht, @NonNull WebMessageCompat nachricht,
                              @NonNull Uri herkunft, boolean istHauptseite,
                              @NonNull JavaScriptReplyProxy antwort) {
        String text = nachricht.getData();
        if (!istHauptseite || text == null) return;

        // Auch das Zerlegen im Hintergrund – die Nachricht enthält die ganze Sicherung.
        SCHREIBER.execute(() -> {
            JSONObject auftrag;
            try {
                auftrag = new JSONObject(text);
            } catch (JSONException e) {
                return; // Kein Auftrag der Web-App – nichts, worauf sie wartet.
            }
            if (!"dateiSpeichern".equals(auftrag.optString("aktion"))) return;
            JSONObject ergebnis = ausfuehren(auftrag);
            // Antworten darf nur der UI-Thread.
            ansicht.post(() -> antwort.postMessage(ergebnis.toString()));
        });
    }

    private JSONObject ausfuehren(JSONObject auftrag) {
        JSONObject ergebnis = new JSONObject();
        try {
            ergebnis.put("id", auftrag.opt("id"));
            try {
                String name = inDownloadsSpeichern(
                        auftrag.getString("dateiname"),
                        auftrag.getString("inhalt"),
                        auftrag.optString("typ", "application/octet-stream"));
                ergebnis.put("ok", true).put("name", name);
            } catch (JSONException | IOException | RuntimeException e) {
                String grund = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
                ergebnis.put("ok", false).put("fehler", grund);
            }
        } catch (JSONException unmoeglich) {
            // put() scheitert nur an ungültigen Zahlen – hier gibt es keine.
        }
        return ergebnis;
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

        try {
            try (OutputStream aus = speicher.openOutputStream(ziel)) {
                if (aus == null) throw new IOException("Datei lässt sich nicht öffnen");
                aus.write(inhalt.getBytes(StandardCharsets.UTF_8));
            }
            werte.clear();
            werte.put(MediaStore.Downloads.IS_PENDING, 0);
            // Bleibt die Datei „in Arbeit“, ist sie unsichtbar und Android löscht sie
            // nach einigen Tagen – das darf nicht als Erfolg gemeldet werden.
            if (speicher.update(ziel, werte, null, null) != 1) {
                throw new IOException("Datei ließ sich nicht fertigstellen");
            }
        } catch (IOException | RuntimeException e) {
            halbeDateiEntfernen(speicher, ziel);
            throw e;
        }
        return tatsaechlicherName(speicher, ziel, dateiname);
    }

    /** Sonst bliebe ein halb angelegter, unsichtbarer Eintrag im Download-Ordner liegen. */
    private static void halbeDateiEntfernen(ContentResolver speicher, Uri ziel) {
        try {
            speicher.delete(ziel, null, null);
        } catch (RuntimeException ignoriert) {
            // Der ursprüngliche Fehler ist wichtiger; Android räumt „in Arbeit“-Einträge selbst auf.
        }
    }

    /** Die Datei ist hier schon gespeichert – scheitert nur die Namensabfrage, zählt das nicht als Fehler. */
    private static String tatsaechlicherName(ContentResolver speicher, Uri ziel, String vorgabe) {
        try (Cursor c = speicher.query(ziel, new String[]{MediaStore.Downloads.DISPLAY_NAME},
                null, null, null)) {
            return c != null && c.moveToFirst() ? c.getString(0) : vorgabe;
        } catch (RuntimeException e) {
            return vorgabe;
        }
    }
}
