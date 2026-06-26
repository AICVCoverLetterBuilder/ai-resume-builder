package com.cvproai.app.plugins;

import android.content.Context;
import android.content.SharedPreferences;

import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryProductDetailsResult;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name = "PurchaseTrace")
public class PurchaseTracePlugin extends Plugin {
    private static final String PREFS_NAME = "purchase_trace";
    private static final String KEY_EVENTS = "events";
    private static final String KEY_LAST_PHASE = "lastPhase";
    private static final String KEY_LAST_AT = "lastAt";
    private static final int MAX_EVENTS = 160;
    private static final int MAX_PHASE_CHARS = 80;
    private static final int MAX_DETAIL_CHARS = 180;
    private static final long DEFAULT_WATCHDOG_MS = 20_000L;
    private static final long BILLING_PROBE_TIMEOUT_MS = 12_000L;

    private final Object lock = new Object();
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();
    private ScheduledFuture<?> watchdogFuture;

    @PluginMethod
    public void clear(PluginCall call) {
        synchronized (lock) {
            cancelWatchdogLocked(false);
            prefs().edit().clear().commit();
        }
        call.resolve();
    }

    @PluginMethod
    public void mark(PluginCall call) {
        String phase = call.getString("phase", "UNKNOWN");
        String detail = call.getString("detail");
        record(phase, detail);
        call.resolve();
    }

    @PluginMethod
    public void getTrace(PluginCall call) {
        JSObject result = new JSObject();
        result.put("lastPhase", prefs().getString(KEY_LAST_PHASE, ""));
        result.put("lastAt", prefs().getLong(KEY_LAST_AT, 0L));

        JSArray events = new JSArray();
        for (String encoded : readEvents()) {
            events.put(decodeEvent(encoded));
        }
        result.put("events", events);
        call.resolve(result);
    }

    @PluginMethod
    public void ping(PluginCall call) {
        JSObject result = new JSObject();
        result.put("success", true);
        result.put("timestamp", System.currentTimeMillis());
        call.resolve(result);
    }

    @PluginMethod
    public void armWatchdog(PluginCall call) {
        long timeoutMs = call.getLong("timeoutMs", DEFAULT_WATCHDOG_MS);
        if (timeoutMs <= 0L || timeoutMs > 120_000L) {
            timeoutMs = DEFAULT_WATCHDOG_MS;
        }
        final long watchdogTimeoutMs = timeoutMs;

        synchronized (lock) {
            cancelWatchdogLocked(false);
            record("NATIVE_WATCHDOG_ARMED", "timeoutMs=" + watchdogTimeoutMs);
            watchdogFuture = scheduler.schedule(
                () -> record("NATIVE_WATCHDOG_FIRED", "timeoutMs=" + watchdogTimeoutMs),
                watchdogTimeoutMs,
                TimeUnit.MILLISECONDS
            );
        }

        JSObject result = new JSObject();
        result.put("armed", true);
        result.put("timeoutMs", watchdogTimeoutMs);
        call.resolve(result);
    }

    @PluginMethod
    public void cancelWatchdog(PluginCall call) {
        synchronized (lock) {
            cancelWatchdogLocked(true);
        }
        call.resolve();
    }

    @PluginMethod
    public void probeBilling(PluginCall call) {
        String productId = sanitizeProductId(call.getString("productId"));
        if (productId == null) {
            record("BILLING_PROBE_REJECTED", "missing productId");
            call.reject("Missing productId");
            return;
        }

        AtomicBoolean completed = new AtomicBoolean(false);
        final BillingClient[] clientRef = new BillingClient[1];

        ScheduledFuture<?> timeout = scheduler.schedule(() -> {
            if (!completed.compareAndSet(false, true)) return;
            record("BILLING_PROBE_TIMEOUT", "timeoutMs=" + BILLING_PROBE_TIMEOUT_MS);
            endConnectionQuietly(clientRef[0]);
            call.reject("Billing probe timed out");
        }, BILLING_PROBE_TIMEOUT_MS, TimeUnit.MILLISECONDS);

        try {
            BillingClient billingClient = BillingClient.newBuilder(getContext())
                .enablePendingPurchases(
                    PendingPurchasesParams.newBuilder()
                        .enableOneTimeProducts()
                        .build()
                )
                .setListener((billingResult, purchases) -> {
                    // Query-only probe: purchases are never launched here.
                })
                .build();
            clientRef[0] = billingClient;

            record("BILLING_CONNECTION_STARTED", "productType=INAPP");
            billingClient.startConnection(new BillingClientStateListener() {
                @Override
                public void onBillingSetupFinished(BillingResult billingResult) {
                    recordBillingResult("BILLING_CONNECTION_RESULT", billingResult);
                    if (!isOk(billingResult)) {
                        finishProbe(call, completed, timeout, billingClient, false, billingResult, null);
                        return;
                    }
                    queryProduct(call, completed, timeout, billingClient, productId);
                }

                @Override
                public void onBillingServiceDisconnected() {
                    record("BILLING_SERVICE_DISCONNECTED", "");
                }
            });
        } catch (Exception e) {
            if (completed.compareAndSet(false, true)) {
                timeout.cancel(false);
                record("BILLING_PROBE_ERROR", safeMessage(e));
                endConnectionQuietly(clientRef[0]);
                call.reject("Billing probe failed");
            }
        }
    }

    private void queryProduct(
        PluginCall call,
        AtomicBoolean completed,
        ScheduledFuture<?> timeout,
        BillingClient billingClient,
        String productId
    ) {
        QueryProductDetailsParams.Product product = QueryProductDetailsParams.Product.newBuilder()
            .setProductId(productId)
            .setProductType(BillingClient.ProductType.INAPP)
            .build();

        QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
            .setProductList(Collections.singletonList(product))
            .build();

        billingClient.queryProductDetailsAsync(params, (billingResult, queryResult) -> {
            recordBillingResult("PRODUCT_QUERY_RESULT", billingResult);
            ProductDetails found = firstProduct(queryResult);
            if (found != null) {
                record("PRODUCT_FOUND", "productId=" + sanitizeProductId(found.getProductId()) + ";productType=" + sanitize(found.getProductType(), 40));
            } else {
                record("PRODUCT_NOT_FOUND", "productId=" + productId + ";productType=INAPP");
            }
            finishProbe(call, completed, timeout, billingClient, found != null, billingResult, found);
        });
    }

    private void finishProbe(
        PluginCall call,
        AtomicBoolean completed,
        ScheduledFuture<?> timeout,
        BillingClient billingClient,
        boolean found,
        BillingResult billingResult,
        ProductDetails productDetails
    ) {
        if (!completed.compareAndSet(false, true)) return;
        timeout.cancel(false);
        endConnectionQuietly(billingClient);

        JSObject result = new JSObject();
        result.put("connected", isOk(billingResult));
        result.put("responseCode", billingResult != null ? billingResult.getResponseCode() : -1);
        result.put("productFound", found);
        if (productDetails != null) {
            result.put("productId", sanitizeProductId(productDetails.getProductId()));
            result.put("productType", sanitize(productDetails.getProductType(), 40));
        }
        call.resolve(result);
    }

    private ProductDetails firstProduct(QueryProductDetailsResult queryResult) {
        if (queryResult == null || queryResult.getProductDetailsList() == null || queryResult.getProductDetailsList().isEmpty()) {
            return null;
        }
        return queryResult.getProductDetailsList().get(0);
    }

    private boolean isOk(BillingResult billingResult) {
        return billingResult != null && billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK;
    }

    private void cancelWatchdogLocked(boolean recordCancel) {
        if (watchdogFuture != null) {
            watchdogFuture.cancel(false);
            watchdogFuture = null;
        }
        if (recordCancel) {
            record("NATIVE_WATCHDOG_CANCELLED", "");
        }
    }

    private void recordBillingResult(String phase, BillingResult billingResult) {
        if (billingResult == null) {
            record(phase, "responseCode=-1;debugMessage=");
            return;
        }
        record(
            phase,
            "responseCode=" + billingResult.getResponseCode() +
                ";debugMessage=" + sanitize(billingResult.getDebugMessage(), MAX_DETAIL_CHARS)
        );
    }

    private void record(String phase, String detail) {
        long now = System.currentTimeMillis();
        String cleanPhase = sanitizePhase(phase);
        String cleanDetail = sanitize(detail, MAX_DETAIL_CHARS);
        String encoded = now + "|" + cleanPhase + "|" + cleanDetail;

        synchronized (lock) {
            ArrayList<String> events = readEvents();
            events.add(encoded);
            while (events.size() > MAX_EVENTS) {
                events.remove(0);
            }

            SharedPreferences.Editor editor = prefs().edit()
                .putString(KEY_EVENTS, joinEvents(events))
                .putString(KEY_LAST_PHASE, cleanPhase)
                .putLong(KEY_LAST_AT, now);
            editor.commit();
        }
    }

    private ArrayList<String> readEvents() {
        String raw = prefs().getString(KEY_EVENTS, "");
        ArrayList<String> events = new ArrayList<>();
        if (raw == null || raw.isEmpty()) {
            return events;
        }
        String[] parts = raw.split("\\n");
        for (String part : parts) {
            if (!part.isEmpty()) {
                events.add(part);
            }
        }
        return events;
    }

    private JSObject decodeEvent(String encoded) {
        String[] parts = encoded.split("\\|", 3);
        JSObject event = new JSObject();
        event.put("timestamp", parseLong(parts.length > 0 ? parts[0] : "0"));
        event.put("phase", parts.length > 1 ? parts[1] : "");
        event.put("detail", parts.length > 2 ? parts[2] : "");
        return event;
    }

    private String joinEvents(List<String> events) {
        StringBuilder builder = new StringBuilder();
        for (String event : events) {
            if (builder.length() > 0) builder.append('\n');
            builder.append(event);
        }
        return builder.toString();
    }

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    private long parseLong(String value) {
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException e) {
            return 0L;
        }
    }

    private String sanitizeProductId(String value) {
        if (value == null) return null;
        String clean = sanitize(value, 80);
        return clean.isEmpty() ? null : clean;
    }

    private String sanitizePhase(String value) {
        String clean = sanitize(value, MAX_PHASE_CHARS).toUpperCase(Locale.US);
        return clean.isEmpty() ? "UNKNOWN" : clean;
    }

    private String sanitize(String value, int maxChars) {
        if (value == null) return "";
        StringBuilder builder = new StringBuilder();
        for (int i = 0; i < value.length() && builder.length() < maxChars; i++) {
            char ch = value.charAt(i);
            if ((ch >= 'A' && ch <= 'Z') ||
                (ch >= 'a' && ch <= 'z') ||
                (ch >= '0' && ch <= '9') ||
                ch == '_' || ch == '-' || ch == '.' || ch == '=' || ch == ';' || ch == ':' || ch == ' ') {
                builder.append(ch);
            }
        }
        return builder.toString().trim();
    }

    private String safeMessage(Exception error) {
        String message = error.getMessage();
        String fallback = error.getClass().getSimpleName();
        return sanitize(message == null || message.isEmpty() ? fallback : message, MAX_DETAIL_CHARS);
    }

    private void endConnectionQuietly(BillingClient billingClient) {
        if (billingClient == null) return;
        try {
            billingClient.endConnection();
        } catch (Exception ignored) {
            // Best-effort cleanup only.
        }
    }
}
