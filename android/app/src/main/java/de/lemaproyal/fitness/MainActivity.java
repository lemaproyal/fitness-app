package de.lemaproyal.fitness;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.webkit.JsResult;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

/**
 * Die ganze App: ein Vollbild-WebView, das die Fitness-App von GitHub Pages lädt.
 *
 * Warum eine eigene Hülle statt der installierten Web-App in Chrome? So liegen
 * die Trainingsdaten (IndexedDB) im privaten Speicher dieser App, und
 * „Browserdaten löschen“ in Chrome erreicht sie nicht mehr.
 *
 * Neuer Programmcode kommt weiter über GitHub Pages; der Service Worker der
 * Web-App hält ihn offline verfügbar. Eine neue APK braucht es nur, wenn sich
 * an dieser Hülle etwas ändert.
 *
 * Hinweis für targetSdk 36: Dann ruft Android onBackPressed nicht mehr auf und
 * ignoriert windowOptOutEdgeToEdgeEnforcement (values-v35/themes.xml) – beides
 * muss dann umgebaut werden (OnBackInvokedCallback, Fensterränder selbst setzen).
 */
public class MainActivity extends Activity {

    static final String APP_HOST = "lemaproyal.github.io";
    private static final String START_URL = "https://" + APP_HOST + "/fitness-app/";
    private static final String OFFLINE_SEITE = "file:///android_asset/offline.html";
    private static final int ANFRAGE_DATEIAUSWAHL = 1;

    private WebView webView;
    private ValueCallback<Uri[]> dateiRueckruf;
    private View vollbildAnsicht;
    private WebChromeClient.CustomViewCallback vollbildRueckruf;

    @Override
    protected void onCreate(Bundle zustand) {
        super.onCreate(zustand);
        // Nur die Debug-APK lässt sich per DevTools fernsteuern – das nutzt der Emulator-Test.
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);

        webView = new WebView(this);
        WebSettings einstellungen = webView.getSettings();
        einstellungen.setJavaScriptEnabled(true);
        einstellungen.setDomStorageEnabled(true);
        // Wie in Chrome: stumme Übungsvideos dürfen von selbst in Schleife laufen.
        einstellungen.setMediaPlaybackRequiresUserGesture(false);

        webView.setWebViewClient(new SeitenSteuerung());
        webView.setWebChromeClient(new BrowserFunktionen());
        DateiBruecke.anmelden(webView, this);
        setContentView(webView);

        if (zustand == null || webView.restoreState(zustand) == null) {
            webView.loadUrl(START_URL);
        }
    }

    // Ohne diese Weitergabe erfährt die Seite erst verspätet, dass die App in den
    // Hintergrund geht – das Training sichert genau dann die eingetippten Werte
    // (visibilitychange in src/training.js). Außerdem verstummt so ein laufendes Video.
    @Override
    protected void onPause() {
        webView.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
    }

    @Override
    protected void onDestroy() {
        webView.destroy();
        super.onDestroy();
    }

    @Override
    protected void onSaveInstanceState(Bundle zustand) {
        super.onSaveInstanceState(zustand);
        webView.saveState(zustand);
    }

    @Override
    public void onBackPressed() {
        if (vollbildAnsicht != null) {
            vollbildBeenden();
        } else if (OFFLINE_SEITE.equals(webView.getUrl())) {
            // Ein Schritt zurück wäre die Seite, die eben nicht laden konnte – sie
            // führte sofort wieder hierher. Also an ihr vorbei oder ganz hinaus.
            if (webView.canGoBackOrForward(-2)) webView.goBackOrForward(-2);
            else finish();
        } else if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onActivityResult(int anfrage, int ergebnis, Intent daten) {
        if (anfrage != ANFRAGE_DATEIAUSWAHL || dateiRueckruf == null) {
            super.onActivityResult(anfrage, ergebnis, daten);
            return;
        }
        dateiRueckruf.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(ergebnis, daten));
        dateiRueckruf = null;
    }

    private void systemleistenZeigen(boolean zeigen) {
        // Unter Android 11 fehlt die Schnittstelle; dort bleiben die Leisten sichtbar.
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return;
        if (zeigen) getWindow().getInsetsController().show(WindowInsets.Type.systemBars());
        else getWindow().getInsetsController().hide(WindowInsets.Type.systemBars());
    }

    private void vollbildBeenden() {
        ((ViewGroup) getWindow().getDecorView()).removeView(vollbildAnsicht);
        vollbildAnsicht = null;
        webView.setVisibility(View.VISIBLE);
        systemleistenZeigen(true);
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
        vollbildRueckruf.onCustomViewHidden();
        vollbildRueckruf = null;
    }

    /** Hält die App auf ihrer Adresse und fängt Ladefehler ohne Internet ab. */
    private class SeitenSteuerung extends WebViewClient {

        @Override
        public boolean shouldOverrideUrlLoading(WebView ansicht, WebResourceRequest anfrage) {
            // Was in eingebetteten Seiten (YouTube-Player) passiert, bleibt deren Sache.
            if (!anfrage.isForMainFrame()) return false;
            Uri ziel = anfrage.getUrl();
            if (APP_HOST.equals(ziel.getHost())) return false;
            // Fremde Webseiten (z. B. „Auf YouTube ansehen“) gehören in den Browser,
            // nicht in die App. Andere Schemata werden gar nicht erst weitergereicht.
            String schema = ziel.getScheme();
            if (!"https".equals(schema) && !"http".equals(schema)) return true;
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, ziel));
            } catch (ActivityNotFoundException e) {
                Toast.makeText(MainActivity.this, R.string.kein_programm, Toast.LENGTH_SHORT).show();
            }
            return true;
        }

        @Override
        public void onReceivedError(WebView ansicht, WebResourceRequest anfrage, WebResourceError fehler) {
            // Hauptseite nicht ladbar – meist beim allerersten Start ohne Verbindung,
            // solange der Service Worker die App noch nicht zwischengespeichert hat.
            if (anfrage.isForMainFrame()) ansicht.loadUrl(OFFLINE_SEITE);
        }
    }

    /** Was Chrome selbst mitbringt, die WebView aber der App überlässt. */
    private class BrowserFunktionen extends WebChromeClient {

        @Override
        public boolean onShowFileChooser(WebView ansicht, ValueCallback<Uri[]> rueckruf,
                                         FileChooserParams parameter) {
            if (dateiRueckruf != null) dateiRueckruf.onReceiveValue(null);
            dateiRueckruf = rueckruf;
            // Bewusst alle Dateitypen: Android meldet .json je nach Herkunft als
            // application/json oder application/octet-stream – ein engerer Filter
            // würde Sicherungen ausgrauen.
            Intent auswahl = new Intent(Intent.ACTION_GET_CONTENT)
                    .addCategory(Intent.CATEGORY_OPENABLE)
                    .setType("*/*");
            try {
                startActivityForResult(auswahl, ANFRAGE_DATEIAUSWAHL);
                return true;
            } catch (ActivityNotFoundException e) {
                dateiRueckruf = null;
                Toast.makeText(MainActivity.this, R.string.kein_programm, Toast.LENGTH_SHORT).show();
                return false;
            }
        }

        // Eigene Dialoge statt der WebView-Vorgabe, die als Überschrift
        // „Die Seite https://lemaproyal.github.io meldet:“ zeigt.
        @Override
        public boolean onJsAlert(WebView ansicht, String adresse, String text, JsResult ergebnis) {
            dialog(text, ergebnis, false);
            return true;
        }

        @Override
        public boolean onJsConfirm(WebView ansicht, String adresse, String text, JsResult ergebnis) {
            dialog(text, ergebnis, true);
            return true;
        }

        private void dialog(String text, JsResult ergebnis, boolean mitAbbrechen) {
            AlertDialog.Builder aufbau = new AlertDialog.Builder(MainActivity.this)
                    .setTitle(R.string.app_name)
                    .setMessage(text)
                    .setPositiveButton(android.R.string.ok, (d, w) -> ergebnis.confirm())
                    .setOnCancelListener(d -> ergebnis.cancel());
            if (mitAbbrechen) aufbau.setNegativeButton(android.R.string.cancel, (d, w) -> ergebnis.cancel());
            aufbau.show();
        }

        @Override
        public void onShowCustomView(View ansicht, CustomViewCallback rueckruf) {
            if (vollbildAnsicht != null) {
                rueckruf.onCustomViewHidden();
                return;
            }
            vollbildAnsicht = ansicht;
            vollbildRueckruf = rueckruf;
            ((ViewGroup) getWindow().getDecorView()).addView(ansicht, new FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            webView.setVisibility(View.GONE);
            systemleistenZeigen(false);
            // Im Vollbild darf das Video quer laufen, sonst bleibt die App im Hochformat.
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR);
        }

        @Override
        public void onHideCustomView() {
            if (vollbildAnsicht != null) vollbildBeenden();
        }
    }
}
