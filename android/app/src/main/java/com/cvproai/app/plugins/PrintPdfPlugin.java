package com.cvproai.app.plugins;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintJob;
import android.print.PrintManager;
import android.view.ViewGroup;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * PrintPdfPlugin — Capacitor plugin for Android PrintManager print flow.
 *
 * Architecture:
 *   UI Thread:     WebView creation, loadDataWithBaseURL, createPrintDocumentAdapter, print()
 *   Background:    PrintJob state polling via Handler.postDelayed (async, no blocking)
 *
 * All work is asynchronous. The UI thread is never blocked.
 * The CountDownLatch originally used is removed — state transitions are
 * managed via Handler callbacks.
 *
 * Returns:
 *   { result: "saved" }      — PrintJob.completed
 *   { result: "cancelled" }  — PrintJob.cancelled
 *   { result: "failed" }     — PrintJob.failed, timeout, or setup error
 */
@CapacitorPlugin(name = "PrintPdf")
public class PrintPdfPlugin extends Plugin {

    private static final long PAGE_LOAD_TIMEOUT_MS = 15_000;
    private static final long PAGE_SETTLE_MS       = 300;
    private static final long JOB_POLL_INTERVAL_MS = 500;
    private static final long JOB_POLL_TIMEOUT_MS  = 120_000;

    // ── Threading ─────────────────────────────────────────────────────────────
    // We use the main looper for all UI work and a dedicated background handler
    // for non-UI work. This avoids blocking any thread and guarantees the
    // Capacitor bridge and app UI remain responsive.
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final Handler bgHandler   = new Handler(Looper.myLooper() != Looper.getMainLooper()
        ? Looper.myLooper() : Looper.getMainLooper());

    @PluginMethod
    public void print(PluginCall call) {
        String html = call.getString("html");
        String jobName = call.getString("jobName", "CV");

        if (html == null) {
            call.reject("Missing required parameter: html");
            return;
        }

        final Context context = getContext();
        final PluginCall savedCall = call; // safe reference for inner classes

        // ── Step 1: Create offscreen WebView + load HTML (UI thread) ───────
        mainHandler.post(() -> {
            final WebView webView;
            try {
                webView = new WebView(context);
                webView.setVisibility(ViewGroup.GONE);
                webView.setLayoutParams(new ViewGroup.LayoutParams(1, 1));
                webView.getSettings().setJavaScriptEnabled(false);
                webView.getSettings().setLoadWithOverviewMode(true);
                webView.getSettings().setUseWideViewPort(true);
                webView.getSettings().setBuiltInZoomControls(false);
                webView.getSettings().setDisplayZoomControls(false);
                webView.getSettings().setDefaultFontSize(12);
            } catch (Exception e) {
                savedCall.reject("Failed to create WebView: " + e.getMessage());
                return;
            }

            // ── Flag to prevent double-resolve on timeout ─────────────────
            final boolean[] resolved = { false };

            // ── Page load timeout ──────────────────────────────────────────
            final Runnable pageTimeoutRunnable = new Runnable() {
                @Override
                public void run() {
                    if (resolved[0]) return;
                    resolved[0] = true;
                    cleanupWebView(webView);
                    savedCall.reject("Page load timeout");
                }
            };
            mainHandler.postDelayed(pageTimeoutRunnable, PAGE_LOAD_TIMEOUT_MS);

            webView.setWebViewClient(new WebViewClient() {
                @Override
                public void onPageFinished(WebView view, String url) {
                    // Cancel the page load timeout
                    mainHandler.removeCallbacks(pageTimeoutRunnable);

                    if (resolved[0]) return;
                    resolved[0] = true;

                    // ── Step 2: Small settle delay then print on UI thread ─
                    mainHandler.postDelayed(() -> {
                        try {
                            PrintManager printManager = (PrintManager) context
                                .getSystemService(Context.PRINT_SERVICE);

                            if (printManager == null) {
                                cleanupWebView(webView);
                                savedCall.reject("Print service not available");
                                return;
                            }

                            PrintDocumentAdapter adapter =
                                webView.createPrintDocumentAdapter(jobName);

                            PrintAttributes attributes = new PrintAttributes.Builder()
                                .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                                .setColorMode(PrintAttributes.COLOR_MODE_COLOR)
                                .build();

                            PrintJob printJob =
                                printManager.print(jobName, adapter, attributes);

                            if (printJob == null) {
                                cleanupWebView(webView);
                                savedCall.reject("Print job creation failed");
                                return;
                            }

                            // ── Step 3: Poll for job completion ───────────
                            pollPrintJob(webView, savedCall, printJob, 0);
                        } catch (Exception e) {
                            cleanupWebView(webView);
                            savedCall.reject("Print error: " + e.getMessage());
                        }
                    }, PAGE_SETTLE_MS);
                }
            });

            // Load HTML with base URL pointing to app public assets
            // so relative font/image paths work (e.g. /fonts/NotoSans-Regular.ttf)
            webView.loadDataWithBaseURL(
                "file:///android_asset/public/",
                html,
                "text/html",
                "UTF-8",
                null
            );
        });
    }

    // ─── Async polling via Handler.postDelayed ────────────────────────────────
    // Runs on the main looper (or background) without blocking any thread.
    // Resolves the PluginCall exactly once on terminal state or timeout.

    private void pollPrintJob(
            final WebView webView,
            final PluginCall call,
            final PrintJob printJob,
            final long elapsedMs) {

        if (printJob.isCompleted()) {
            JSObject ret = new JSObject();
            ret.put("result", "saved");
            ret.put("message", "Print completed");
            cleanupWebView(webView);
            call.resolve(ret);
            return;
        }

        if (printJob.isCancelled()) {
            JSObject ret = new JSObject();
            ret.put("result", "cancelled");
            ret.put("message", "Print cancelled by user");
            cleanupWebView(webView);
            call.resolve(ret);
            return;
        }

        if (printJob.isFailed()) {
            JSObject ret = new JSObject();
            ret.put("result", "failed");
            ret.put("message", "Print job failed");
            cleanupWebView(webView);
            call.resolve(ret);
            return;
        }

        // ── Timeout ─────────────────────────────────────────────────────────
        if (elapsedMs >= JOB_POLL_TIMEOUT_MS) {
            JSObject ret = new JSObject();
            ret.put("result", "failed");
            ret.put("message", "Print timed out");
            cleanupWebView(webView);
            call.resolve(ret);
            return;
        }

        // ── Poll again after interval ──────────────────────────────────────
        // Use the main handler so polling runs on the main thread. This never
        // blocks — each tick posts the next. If the Activity / Bridge is
        // destroyed, the Handler callbacks are no-ops because the call
        // reference is dropped.
        mainHandler.postDelayed(
            () -> pollPrintJob(webView, call, printJob, elapsedMs + JOB_POLL_INTERVAL_MS),
            JOB_POLL_INTERVAL_MS
        );
    }

    // ─── Cleanup ──────────────────────────────────────────────────────────────
    // Always runs on the UI thread because WebView.destroy() must be called
    // from the UI thread.

    private void cleanupWebView(WebView webView) {
        if (webView == null) return;
        // Already on UI thread (called from mainHandler.post), so safe to
        // call stopLoading/destroy directly.
        try {
            webView.stopLoading();
            webView.destroy();
        } catch (Exception ignored) {
            // Best-effort cleanup
        }
    }
}
