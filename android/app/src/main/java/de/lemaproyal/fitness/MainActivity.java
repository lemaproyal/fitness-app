package de.lemaproyal.fitness;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
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

    @Override
    protected void onSaveInstanceState(Bundle zustand) {
        super.onSaveInstanceState(zustand);
        webView.saveState(zustand);
    }

    @Override
    public void onBackPressed() {
        if (vollbildAnsicht != null) {
            vollbildBeenden();
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

    private void vollbildBeenden() {
        ((ViewGroup) getWindow().getDecorView()).removeView(vollbildAnsicht);
        vollbildAnsicht = null;
        webView.setVisibility(View.VISIBLE);
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
        vollbildRueckruf.onCustomViewHidden();
        vollbildRueckruf = null;
    }

    /** Hält die App auf ihrer Adresse und fängt den ersten Start ohne Internet ab. */
    private class SeitenSteuerung extends WebViewClient {

        @Override
        public boolean shouldOverrideUrlLoading(WebView ansicht, WebResourceRequest anfrage) {
            Uri ziel = anfrage.getUrl();
            if (APP_HOST.equals(ziel.getHost())) return false;
            // Fremde Links (z. B. „Auf YouTube ansehen“) gehören in den Browser, nicht in die App.
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, ziel));
            } catch (ActivityNotFoundException e) {
                Toast.makeText(MainActivity.this, R.string.kein_programm, Toast.LENGTH_SHORT).show();
            }
            return true;
        }

        @Override
        public void onReceivedError(WebView ansicht, WebResourceRequest anfrage, WebResourceError fehler) {
            // Tritt nur auf, solange der Service Worker die App noch nicht zwischengespeichert
            // hat – also beim allerersten Start ohne Verbindung.
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
            // Im Vollbild darf das Video quer laufen, sonst bleibt die App im Hochformat.
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR);
        }

        @Override
        public void onHideCustomView() {
            if (vollbildAnsicht != null) vollbildBeenden();
        }
    }
}
