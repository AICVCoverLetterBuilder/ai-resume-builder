package com.cvproai.app.plugins;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.ParcelFileDescriptor;
import android.provider.DocumentsContract;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Capacitor plugin for Android file saving.
 *
 * Android 10+ writes directly to MediaStore Downloads with IS_PENDING until
 * byte-count verification succeeds. Android 9 and lower keep the SAF picker
 * fallback because this app does not request legacy storage permissions.
 */
@CapacitorPlugin(name = "SaveFile")
public class SaveFilePlugin extends Plugin {

    private static final String PLUGIN_VERSION = "1.1.0";
    private static final String TAG = "SaveFilePlugin";
    private static final String DIAGNOSTICS_PREFS = "cvpro_save_diagnostics";
    private static final String DIAGNOSTICS_EVENTS_KEY = "events";
    private static final String PENDING_PREFS = "cvpro_pending_save";
    private static final String PENDING_CALLBACK_ID_KEY = "callbackId";
    private static final String PENDING_TEMP_PATH_KEY = "tempPath";
    private static final String PENDING_EXPECTED_BYTES_KEY = "expectedBytes";
    private static final String PENDING_FORMAT_KEY = "format";
    private static final String PENDING_MIME_TYPE_KEY = "mimeType";
    private static final String SAVE_FILE_CALLBACK = "saveFileResult";
    private static final String DOWNLOAD_RELATIVE_PATH = Environment.DIRECTORY_DOWNLOADS + "/CV Pro AI";
    private static final int BUFFER_SIZE = 8192;
    private static final int MAX_DIAGNOSTIC_EVENTS = 300;

    private final ConcurrentHashMap<String, File> pendingFiles = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Long> pendingExpectedBytes = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, String> pendingFormats = new ConcurrentHashMap<>();
    private final AtomicBoolean saveInProgress = new AtomicBoolean(false);

    @PluginMethod
    public void healthCheck(PluginCall call) {
        File cacheDir = getContext().getCacheDir();
        JSObject result = new JSObject();
        result.put("pluginAvailable", true);
        result.put("cacheWritable", cacheDir != null && cacheDir.exists() && cacheDir.canWrite());
        result.put("pluginVersion", PLUGIN_VERSION);
        call.resolve(result);
    }

    @PluginMethod
    public void getDiagnostics(PluginCall call) {
        JSObject result = new JSObject();
        result.put("events", readDiagnosticEvents());
        call.resolve(result);
    }

    @PluginMethod
    public void clearDiagnostics(PluginCall call) {
        getDiagnosticsPrefs().edit().remove(DIAGNOSTICS_EVENTS_KEY).apply();
        JSObject result = new JSObject();
        result.put("cleared", true);
        call.resolve(result);
    }

    @PluginMethod
    public void saveFile(PluginCall call) {
        if (!saveInProgress.compareAndSet(false, true)) {
            recordFailure("NATIVE_PLUGIN_ENTERED", "IllegalStateException", "other");
            call.reject("Another file save is already in progress");
            return;
        }

        String callbackId = call.getCallbackId();
        File tempFile = null;
        String format = "other";

        try {
            String base64Data = call.getString("base64Data");
            String fileName = call.getString("fileName");
            String mimeType = call.getString("mimeType");
            Integer expectedBytes = call.getInt("expectedBytes");
            format = safeMimeLabel(mimeType);

            recordDiagnostic("NATIVE_PLUGIN_ENTERED", format, null, null, null, null, null, null, null, null, null, null);
            recordDiagnostic("NATIVE_BASE64_RECEIVED", format, null, null, base64Data != null ? base64Data.length() : 0, null, null, null, null, null, null, null);
            recordDiagnostic("NATIVE_EXPECTED_BYTES", format, null, null, null, expectedBytes != null ? expectedBytes.longValue() : 0, null, null, null, null, null, null);

            if (base64Data == null || base64Data.isEmpty() ||
                fileName == null || fileName.isEmpty() ||
                mimeType == null || mimeType.isEmpty() ||
                expectedBytes == null || expectedBytes <= 0) {
                saveInProgress.set(false);
                recordFailure("NATIVE_PLUGIN_ENTERED", "IllegalArgumentException", format);
                call.reject("Missing required parameter: base64Data, fileName, mimeType, or expectedBytes");
                return;
            }

            byte[] decodedBytes = Base64.decode(base64Data, Base64.DEFAULT);
            recordDiagnostic("NATIVE_BASE64_DECODED", format, null, null, null, null, decodedBytes.length, null, null, null, null, null);
            if (decodedBytes.length == 0) {
                saveInProgress.set(false);
                recordFailure("NATIVE_BASE64_DECODED", "IllegalArgumentException", format);
                call.reject("Decoded file is empty");
                return;
            }
            if (decodedBytes.length != expectedBytes) {
                saveInProgress.set(false);
                recordFailure("NATIVE_BASE64_DECODED", "IllegalArgumentException", format);
                call.reject("Decoded file size does not match expected byte count");
                return;
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                saveToMediaStoreDownloads(call, decodedBytes, fileName, mimeType, expectedBytes.longValue(), format);
                return;
            }

            tempFile = File.createTempFile("cvpro-export-", ".tmp", getContext().getCacheDir());
            try (FileOutputStream output = new FileOutputStream(tempFile)) {
                output.write(decodedBytes);
                output.flush();
            }
            recordDiagnostic("TEMP_FILE_WRITTEN", format, null, null, null, expectedBytes.longValue(), decodedBytes.length, null, null, null, null, null);

            pendingFiles.put(callbackId, tempFile);
            pendingExpectedBytes.put(callbackId, Long.valueOf(expectedBytes));
            pendingFormats.put(callbackId, format);
            persistPendingSave(callbackId, tempFile, Long.valueOf(expectedBytes), format, mimeType);
            Log.d(TAG, "Prepared export payload type=" + safeMimeLabel(mimeType) + " bytes=" + decodedBytes.length);

            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType(mimeType);
            intent.putExtra(Intent.EXTRA_TITLE, fileName);

            recordDiagnostic("SAF_PICKER_LAUNCHED", format, null, null, null, expectedBytes.longValue(), decodedBytes.length, null, null, null, null, null);
            startActivityForResult(call, intent, SAVE_FILE_CALLBACK);
        } catch (IllegalArgumentException e) {
            cleanupPending(callbackId, tempFile);
            saveInProgress.set(false);
            recordFailure("NATIVE_BASE64_DECODED", e.getClass().getSimpleName(), format);
            call.reject("Invalid Base64 file data", e);
        } catch (IOException | SecurityException e) {
            cleanupPending(callbackId, tempFile);
            saveInProgress.set(false);
            recordFailure("TEMP_FILE_WRITTEN", e.getClass().getSimpleName(), format);
            call.reject("Unable to prepare file for saving: " + safeMessage(e), e);
        } catch (Exception e) {
            cleanupPending(callbackId, tempFile);
            saveInProgress.set(false);
            recordFailure("NATIVE_PLUGIN_ENTERED", e.getClass().getSimpleName(), format);
            call.reject("Unexpected file-save error: " + safeMessage(e), e);
        }
    }

    private void saveToMediaStoreDownloads(
        PluginCall call,
        byte[] decodedBytes,
        String requestedFileName,
        String mimeType,
        Long expectedBytes,
        String format
    ) {
        Uri destination = null;
        String finalDisplayName = null;
        long bytesWritten = 0;

        try {
            recordDiagnostic("MEDIASTORE_SAVE_ENTERED", format, null, null, null, expectedBytes, decodedBytes.length, null, null, null, null, null);
            ContentResolver resolver = getContext().getContentResolver();
            finalDisplayName = makeUniqueDisplayName(resolver, sanitizeDisplayFileName(requestedFileName));

            ContentValues values = new ContentValues();
            values.put(MediaStore.MediaColumns.DISPLAY_NAME, finalDisplayName);
            values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
            values.put(MediaStore.MediaColumns.RELATIVE_PATH, DOWNLOAD_RELATIVE_PATH);
            values.put(MediaStore.MediaColumns.IS_PENDING, 1);

            recordDiagnostic("MEDIASTORE_VALUES_READY", format, null, null, null, expectedBytes, decodedBytes.length, null, null, null, null, null);
            recordDiagnostic("MEDIASTORE_INSERT_STARTED", format, null, null, null, expectedBytes, decodedBytes.length, null, null, null, null, null);
            destination = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (destination == null) {
                recordMediaStoreFailure("MEDIASTORE_INSERT_STARTED", "IllegalStateException", format);
                call.reject("Could not create Downloads entry");
                return;
            }
            recordDiagnostic("MEDIASTORE_INSERT_COMPLETED", format, null, null, null, expectedBytes, decodedBytes.length, null, null, null, destination.getAuthority(), null);

            recordDiagnostic("MEDIASTORE_WRITE_STARTED", format, null, null, null, expectedBytes, decodedBytes.length, null, null, null, destination.getAuthority(), null);
            try (ParcelFileDescriptor descriptor = resolver.openFileDescriptor(destination, "rwt")) {
                if (descriptor == null) {
                    boolean deleted = deleteDestinationQuietly(destination);
                    recordDiagnostic("MEDIASTORE_FAILED_ROW_DELETED", format, null, null, null, expectedBytes, decodedBytes.length, 0L, 0L, null, destination.getAuthority(), deleted);
                    recordMediaStoreFailure("MEDIASTORE_WRITE_STARTED", "IllegalStateException", format);
                    call.reject("Could not open Downloads entry for writing");
                    return;
                }

                try (FileOutputStream output = new FileOutputStream(descriptor.getFileDescriptor())) {
                    output.write(decodedBytes);
                    bytesWritten = decodedBytes.length;
                    recordDiagnostic("MEDIASTORE_WRITE_COMPLETED", format, null, null, null, expectedBytes, decodedBytes.length, bytesWritten, null, null, destination.getAuthority(), null);
                    output.flush();
                    output.getFD().sync();
                    recordDiagnostic("MEDIASTORE_SYNC_COMPLETED", format, null, null, null, expectedBytes, decodedBytes.length, bytesWritten, null, null, destination.getAuthority(), null);
                }
            }

            recordDiagnostic("MEDIASTORE_READBACK_STARTED", format, null, null, null, expectedBytes, decodedBytes.length, bytesWritten, null, null, destination.getAuthority(), null);
            long verifiedSize = readBackByteCount(destination);
            recordDiagnostic("MEDIASTORE_READBACK_COMPLETED", format, null, null, null, expectedBytes, decodedBytes.length, bytesWritten, verifiedSize, null, destination.getAuthority(), null);

            if (bytesWritten <= 0 || verifiedSize <= 0) {
                boolean deleted = deleteDestinationQuietly(destination);
                recordDiagnostic("MEDIASTORE_FAILED_ROW_DELETED", format, null, null, null, expectedBytes, decodedBytes.length, bytesWritten, verifiedSize, null, destination.getAuthority(), deleted);
                recordMediaStoreFailure("MEDIASTORE_READBACK_COMPLETED", "IllegalStateException", format);
                call.reject("No file data was written");
                return;
            }

            if (bytesWritten != expectedBytes || verifiedSize != expectedBytes) {
                boolean deleted = deleteDestinationQuietly(destination);
                recordDiagnostic("MEDIASTORE_FAILED_ROW_DELETED", format, null, null, null, expectedBytes, decodedBytes.length, bytesWritten, verifiedSize, null, destination.getAuthority(), deleted);
                recordMediaStoreFailure("MEDIASTORE_READBACK_COMPLETED", "IllegalStateException", format);
                call.reject("Saved file size did not match generated file");
                return;
            }

            ContentValues publishValues = new ContentValues();
            publishValues.put(MediaStore.MediaColumns.IS_PENDING, 0);
            resolver.update(destination, publishValues, null, null);
            recordDiagnostic("MEDIASTORE_PUBLISHED", format, null, null, null, expectedBytes, decodedBytes.length, bytesWritten, verifiedSize, null, destination.getAuthority(), null);
            recordDiagnostic("MEDIASTORE_SAVE_SUCCESS", format, null, null, null, expectedBytes, decodedBytes.length, bytesWritten, verifiedSize, null, destination.getAuthority(), null);
            resolve(call, "saved", "Saved to Downloads/CV Pro AI", bytesWritten, verifiedSize, destination.getAuthority(), finalDisplayName);
        } catch (IOException | SecurityException e) {
            if (destination != null) {
                boolean deleted = deleteDestinationQuietly(destination);
                recordDiagnostic("MEDIASTORE_FAILED_ROW_DELETED", format, null, null, null, expectedBytes, decodedBytes.length, bytesWritten, null, null, destination.getAuthority(), deleted);
            }
            recordMediaStoreFailure("MEDIASTORE_WRITE_COMPLETED", e.getClass().getSimpleName(), format);
            call.reject("Error writing file: " + safeMessage(e), e);
        } catch (Exception e) {
            if (destination != null) {
                boolean deleted = deleteDestinationQuietly(destination);
                recordDiagnostic("MEDIASTORE_FAILED_ROW_DELETED", format, null, null, null, expectedBytes, decodedBytes.length, bytesWritten, null, null, destination.getAuthority(), deleted);
            }
            recordMediaStoreFailure("MEDIASTORE_SAVE_ENTERED", e.getClass().getSimpleName(), format);
            call.reject("Unexpected file-save error: " + safeMessage(e), e);
        } finally {
            saveInProgress.set(false);
        }
    }

    @ActivityCallback
    private void saveFileResult(PluginCall call, ActivityResult activityResult) {
        int resultCode = activityResult != null ? activityResult.getResultCode() : Integer.MIN_VALUE;
        Intent data = activityResult != null ? activityResult.getData() : null;
        Uri destination = data != null ? data.getData() : null;
        boolean callPresent = call != null;
        String callbackId = callPresent ? call.getCallbackId() : null;
        PendingSave pendingSave = recoverPendingSave(callbackId);
        File tempFile = pendingSave != null ? pendingSave.tempFile : null;
        Long expectedBytes = pendingSave != null ? pendingSave.expectedBytes : null;
        String format = pendingSave != null ? pendingSave.format : "other";

        recordCallbackDiagnostic("SAF_CALLBACK_ENTERED", resultCode, null, null, format, expectedBytes);
        recordCallbackDiagnostic("SAF_CALLBACK_CALL_PRESENT", resultCode, callPresent, null, format, expectedBytes);
        recordCallbackDiagnostic("SAF_CALLBACK_DATA_PRESENT", resultCode, null, data != null, format, expectedBytes);

        try {
            if (activityResult == null) {
                recordDiagnostic("PENDING_SAVE_MISSING", format, null, null, null, expectedBytes, null, null, null, null, null, null);
                rejectIfPossible(call, "Save result was unavailable");
                return;
            }

            if (activityResult.getResultCode() == Activity.RESULT_CANCELED) {
                recordDiagnostic("SAF_RESULT_CANCELLED", format, null, null, null, expectedBytes, null, null, null, null, null, null);
                if (callPresent) {
                    resolve(call, "cancelled", "User cancelled the save dialog", 0, 0);
                }
                return;
            }

            if (activityResult.getResultCode() != Activity.RESULT_OK || destination == null) {
                recordFailure("SAF_URI_RETURNED", "IllegalStateException", format);
                rejectIfPossible(call, "Save was not completed");
                return;
            }
            recordDiagnostic("SAF_URI_RETURNED", format, null, null, null, expectedBytes, null, null, null, null, destination.getAuthority(), null);

            if (!callPresent) {
                boolean deleted = deleteDestinationQuietly(destination);
                recordDiagnostic("FAILED_DESTINATION_DELETE_RESULT", format, null, null, null, expectedBytes, null, null, null, null, destination.getAuthority(), deleted);
                recordFailure("SAF_CALLBACK_CALL_PRESENT", "IllegalStateException", format);
                return;
            }

            if (!isUsablePendingSave(pendingSave)) {
                boolean deleted = deleteDestinationQuietly(destination);
                recordDiagnostic("PENDING_SAVE_MISSING", format, null, null, null, expectedBytes, null, null, null, null, destination.getAuthority(), null);
                recordDiagnostic("FAILED_DESTINATION_DELETE_RESULT", format, null, null, null, expectedBytes, null, 0L, 0L, null, destination.getAuthority(), deleted);
                recordFailure("PENDING_SAVE_MISSING", "IllegalStateException", format);
                call.reject("Prepared file data is unavailable");
                return;
            }
            recordDiagnostic("PENDING_SAVE_RECOVERED", format, null, null, null, expectedBytes, null, null, null, null, null, null);

            long bytesWritten = 0;
            recordDiagnostic("DESTINATION_OPEN_STARTED", format, null, null, null, expectedBytes, null, null, null, null, destination.getAuthority(), null);
            try (
                ParcelFileDescriptor descriptor = getContext().getContentResolver().openFileDescriptor(destination, "rwt");
                FileInputStream input = new FileInputStream(tempFile)
            ) {
                if (descriptor == null) {
                    boolean deleted = deleteDestinationQuietly(destination);
                    recordDiagnostic("FAILED_DESTINATION_DELETE_RESULT", format, null, null, null, expectedBytes, null, 0L, 0L, null, destination.getAuthority(), deleted);
                    recordFailure("DESTINATION_OPEN_STARTED", "IllegalStateException", format);
                    call.reject("Could not open destination for writing");
                    return;
                }
                recordDiagnostic("DESTINATION_OPENED", format, null, null, null, expectedBytes, null, null, null, null, destination.getAuthority(), null);

                try (FileOutputStream output = new FileOutputStream(descriptor.getFileDescriptor())) {
                    recordDiagnostic("DESTINATION_COPY_STARTED", format, null, null, null, expectedBytes, null, null, null, null, destination.getAuthority(), null);
                    byte[] buffer = new byte[BUFFER_SIZE];
                    int count;
                    while ((count = input.read(buffer)) != -1) {
                        output.write(buffer, 0, count);
                        bytesWritten += count;
                    }
                    recordDiagnostic("DESTINATION_COPY_COMPLETED", format, null, null, null, expectedBytes, null, bytesWritten, null, null, destination.getAuthority(), null);
                    output.flush();
                    recordDiagnostic("DESTINATION_FLUSH_COMPLETED", format, null, null, null, expectedBytes, null, bytesWritten, null, null, destination.getAuthority(), null);
                    output.getFD().sync();
                }
            }
            recordDiagnostic("DESTINATION_STREAM_CLOSED", format, null, null, null, expectedBytes, null, bytesWritten, null, null, destination.getAuthority(), null);

            recordDiagnostic("DESTINATION_READBACK_STARTED", format, null, null, null, expectedBytes, null, bytesWritten, null, null, destination.getAuthority(), null);
            long verifiedSize = readBackByteCount(destination);
            recordDiagnostic("DESTINATION_READBACK_COMPLETED", format, null, null, null, expectedBytes, null, bytesWritten, verifiedSize, null, destination.getAuthority(), null);
            Log.d(TAG, "Completed export write bytesWritten=" + bytesWritten + " verifiedSize=" + verifiedSize);

            if (bytesWritten <= 0 || verifiedSize <= 0) {
                boolean deleted = deleteDestinationQuietly(destination);
                recordDiagnostic("FAILED_DESTINATION_DELETE_RESULT", format, null, null, null, expectedBytes, null, bytesWritten, verifiedSize, null, destination.getAuthority(), deleted);
                recordFailure("DESTINATION_READBACK_COMPLETED", "IllegalStateException", format);
                call.reject("No file data was written");
                return;
            }

            if (bytesWritten != expectedBytes || verifiedSize != expectedBytes) {
                boolean deleted = deleteDestinationQuietly(destination);
                recordDiagnostic("FAILED_DESTINATION_DELETE_RESULT", format, null, null, null, expectedBytes, null, bytesWritten, verifiedSize, null, destination.getAuthority(), deleted);
                recordFailure("DESTINATION_READBACK_COMPLETED", "IllegalStateException", format);
                call.reject("Saved file size did not match generated file");
                return;
            }

            recordDiagnostic("NATIVE_SAVE_SUCCESS", format, null, null, null, expectedBytes, null, bytesWritten, verifiedSize, null, destination.getAuthority(), null);
            resolve(call, "saved", "File saved successfully", bytesWritten, verifiedSize);
        } catch (IOException | SecurityException e) {
            if (destination != null) {
                boolean deleted = deleteDestinationQuietly(destination);
                recordDiagnostic("FAILED_DESTINATION_DELETE_RESULT", format, null, null, null, expectedBytes, null, null, null, null, destination.getAuthority(), deleted);
            }
            recordFailure("DESTINATION_COPY_COMPLETED", e.getClass().getSimpleName(), format);
            rejectIfPossible(call, "Error writing file: " + safeMessage(e), e);
        } catch (Exception e) {
            if (destination != null) {
                boolean deleted = deleteDestinationQuietly(destination);
                recordDiagnostic("FAILED_DESTINATION_DELETE_RESULT", format, null, null, null, expectedBytes, null, null, null, null, destination.getAuthority(), deleted);
            }
            recordFailure("DESTINATION_COPY_COMPLETED", e.getClass().getSimpleName(), format);
            rejectIfPossible(call, "Unexpected file-save error: " + safeMessage(e), e);
        } finally {
            cleanupPending(callbackId, tempFile);
            saveInProgress.set(false);
        }
    }

    private void cleanupPending(String callbackId, File tempFile) {
        if (callbackId != null) {
            pendingFiles.remove(callbackId);
            pendingExpectedBytes.remove(callbackId);
            pendingFormats.remove(callbackId);
        }
        clearPersistedPendingSave();
        deleteTempFileQuietly(tempFile);
    }

    private void persistPendingSave(String callbackId, File tempFile, Long expectedBytes, String format, String mimeType) {
        getPendingPrefs()
            .edit()
            .putString(PENDING_CALLBACK_ID_KEY, callbackId)
            .putString(PENDING_TEMP_PATH_KEY, tempFile.getAbsolutePath())
            .putLong(PENDING_EXPECTED_BYTES_KEY, expectedBytes)
            .putString(PENDING_FORMAT_KEY, format == null ? "other" : format)
            .putString(PENDING_MIME_TYPE_KEY, mimeType == null ? "" : mimeType)
            .apply();
    }

    private PendingSave recoverPendingSave(String callbackId) {
        if (callbackId != null) {
            File tempFile = pendingFiles.get(callbackId);
            Long expectedBytes = pendingExpectedBytes.get(callbackId);
            String format = pendingFormats.get(callbackId);
            PendingSave inMemory = makePendingSave(tempFile, expectedBytes, format);
            if (inMemory != null) {
                return inMemory;
            }
        }

        SharedPreferences prefs = getPendingPrefs();
        String tempPath = prefs.getString(PENDING_TEMP_PATH_KEY, null);
        long expectedBytes = prefs.getLong(PENDING_EXPECTED_BYTES_KEY, 0L);
        String format = prefs.getString(PENDING_FORMAT_KEY, "other");
        if (tempPath == null || expectedBytes <= 0L) {
            return null;
        }
        File tempFile = new File(tempPath);
        if (!isAppPrivateCacheFile(tempFile)) {
            return null;
        }
        return makePendingSave(tempFile, expectedBytes, format);
    }

    private PendingSave makePendingSave(File tempFile, Long expectedBytes, String format) {
        if (tempFile == null || expectedBytes == null || expectedBytes <= 0L) {
            return null;
        }
        return new PendingSave(tempFile, expectedBytes, format == null ? "other" : format);
    }

    private boolean isUsablePendingSave(PendingSave pendingSave) {
        return pendingSave != null &&
            pendingSave.tempFile.exists() &&
            pendingSave.tempFile.length() > 0 &&
            pendingSave.expectedBytes > 0 &&
            pendingSave.tempFile.length() == pendingSave.expectedBytes;
    }

    private boolean isAppPrivateCacheFile(File file) {
        if (file == null) return false;
        try {
            String cachePath = getContext().getCacheDir().getCanonicalPath();
            String filePath = file.getCanonicalPath();
            return filePath.startsWith(cachePath + File.separator);
        } catch (IOException e) {
            return false;
        }
    }

    private void clearPersistedPendingSave() {
        getPendingPrefs().edit().clear().apply();
    }

    private SharedPreferences getPendingPrefs() {
        return getContext().getSharedPreferences(PENDING_PREFS, Activity.MODE_PRIVATE);
    }

    private void deleteTempFileQuietly(File file) {
        if (file != null && file.exists()) {
            // Cache files are non-sensitive temporary export data. A failed
            // delete is safe because Android may clear the app cache later.
            //noinspection ResultOfMethodCallIgnored
            file.delete();
        }
    }

    private long readBackByteCount(Uri destination) throws IOException {
        long total = 0;
        try (InputStream input = getContext().getContentResolver().openInputStream(destination)) {
            if (input == null) {
                return 0;
            }
            byte[] buffer = new byte[BUFFER_SIZE];
            int count;
            while ((count = input.read(buffer)) != -1) {
                total += count;
            }
        }
        return total;
    }

    private boolean deleteDestinationQuietly(Uri destination) {
        if (destination == null) return false;
        try {
            int rows = getContext().getContentResolver().delete(destination, null, null);
            if (rows > 0) return true;
        } catch (Exception ignored) {
            // Fall through to DocumentsContract for legacy SAF providers.
        }
        try {
            return DocumentsContract.deleteDocument(getContext().getContentResolver(), destination);
        } catch (Exception ignored) {
            Log.d(TAG, "Unable to delete failed export destination");
            return false;
        }
    }

    private void resolve(PluginCall call, String resultValue, String message, long bytesWritten, long verifiedSize) {
        resolve(call, resultValue, message, bytesWritten, verifiedSize, null, null);
    }

    private void resolve(
        PluginCall call,
        String resultValue,
        String message,
        long bytesWritten,
        long verifiedSize,
        String uriAuthority,
        String displayName
    ) {
        JSObject result = new JSObject();
        result.put("result", resultValue);
        result.put("message", message);
        result.put("bytesWritten", bytesWritten);
        result.put("verifiedSize", verifiedSize);
        if (uriAuthority != null) result.put("uriAuthority", uriAuthority);
        if (displayName != null) result.put("displayName", displayName);
        call.resolve(result);
    }

    private String sanitizeDisplayFileName(String requestedFileName) {
        String cleaned = requestedFileName == null ? "" : requestedFileName.trim();
        cleaned = cleaned.replaceAll("[\\\\/:*?\"<>|]", " ").replaceAll("\\s+", " ").trim();
        if (cleaned.isEmpty()) {
            return "My CV";
        }
        return cleaned;
    }

    private String makeUniqueDisplayName(ContentResolver resolver, String sanitizedFileName) throws IOException {
        String baseName = sanitizedFileName;
        String extension = "";
        int dotIndex = sanitizedFileName.lastIndexOf('.');
        if (dotIndex > 0 && dotIndex < sanitizedFileName.length() - 1) {
            baseName = sanitizedFileName.substring(0, dotIndex);
            extension = sanitizedFileName.substring(dotIndex);
        }

        String candidate = sanitizedFileName;
        for (int index = 0; index < 1000; index++) {
            if (index > 0) {
                candidate = baseName + " (" + index + ")" + extension;
            }
            if (!displayNameExistsInDownloadsFolder(resolver, candidate)) {
                return candidate;
            }
        }
        throw new IOException("Unable to choose a unique Downloads filename");
    }

    private boolean displayNameExistsInDownloadsFolder(ContentResolver resolver, String displayName) {
        String[] projection = new String[] {
            MediaStore.MediaColumns.DISPLAY_NAME,
            MediaStore.MediaColumns.RELATIVE_PATH
        };
        String selection = MediaStore.MediaColumns.DISPLAY_NAME + "=?";
        String[] selectionArgs = new String[] { displayName };

        try (Cursor cursor = resolver.query(
            MediaStore.Downloads.EXTERNAL_CONTENT_URI,
            projection,
            selection,
            selectionArgs,
            null
        )) {
            if (cursor == null) return false;
            int relativePathIndex = cursor.getColumnIndex(MediaStore.MediaColumns.RELATIVE_PATH);
            while (cursor.moveToNext()) {
                String relativePath = relativePathIndex >= 0 ? cursor.getString(relativePathIndex) : "";
                if (normalizeRelativePath(relativePath).equals(normalizeRelativePath(DOWNLOAD_RELATIVE_PATH))) {
                    return true;
                }
            }
        } catch (Exception e) {
            Log.d(TAG, "Unable to check duplicate Downloads filename");
        }
        return false;
    }

    private String normalizeRelativePath(String relativePath) {
        if (relativePath == null) return "";
        String normalized = relativePath.replace("\\", "/");
        while (normalized.endsWith("/")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        return normalized;
    }

    private String safeMimeLabel(String mimeType) {
        if ("application/pdf".equals(mimeType)) return "pdf";
        if ("application/vnd.openxmlformats-officedocument.wordprocessingml.document".equals(mimeType)) return "docx";
        return "other";
    }

    private SharedPreferences getDiagnosticsPrefs() {
        return getContext().getSharedPreferences(DIAGNOSTICS_PREFS, Activity.MODE_PRIVATE);
    }

    private synchronized JSONArray readDiagnosticEvents() {
        String raw = getDiagnosticsPrefs().getString(DIAGNOSTICS_EVENTS_KEY, "[]");
        try {
            return new JSONArray(raw);
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    private synchronized void recordDiagnostic(
        String phase,
        String format,
        Long blobSize,
        Long byteLength,
        Integer base64Length,
        Long expectedBytes,
        Integer decodedBytes,
        Long bytesWritten,
        Long verifiedSize,
        String failedStage,
        String uriAuthority,
        Boolean deleted
    ) {
        try {
            JSONArray events = readDiagnosticEvents();
            JSONObject event = new JSONObject();
            event.put("ts", System.currentTimeMillis());
            event.put("source", "native");
            event.put("phase", phase);
            event.put("format", format == null ? "other" : format);
            if (blobSize != null) event.put("blobSize", blobSize);
            if (byteLength != null) event.put("byteLength", byteLength);
            if (base64Length != null) event.put("base64Length", base64Length);
            if (expectedBytes != null) event.put("expectedBytes", expectedBytes);
            if (decodedBytes != null) event.put("decodedBytes", decodedBytes);
            if (bytesWritten != null) event.put("bytesWritten", bytesWritten);
            if (verifiedSize != null) event.put("verifiedSize", verifiedSize);
            if (failedStage != null) event.put("failedStage", failedStage);
            if (uriAuthority != null) event.put("uriAuthority", uriAuthority);
            if (deleted != null) event.put("deleted", deleted);
            events.put(event);
            while (events.length() > MAX_DIAGNOSTIC_EVENTS) {
                events.remove(0);
            }
            getDiagnosticsPrefs().edit().putString(DIAGNOSTICS_EVENTS_KEY, events.toString()).apply();
        } catch (JSONException e) {
            Log.d(TAG, "Unable to persist save diagnostic");
        }
    }

    private void recordFailure(String failedStage, String exceptionClass, String format) {
        try {
            JSONArray events = readDiagnosticEvents();
            JSONObject event = new JSONObject();
            event.put("ts", System.currentTimeMillis());
            event.put("source", "native");
            event.put("phase", "NATIVE_SAVE_FAILED");
            event.put("format", format == null ? "other" : format);
            event.put("failedStage", failedStage);
            event.put("exceptionClass", exceptionClass);
            events.put(event);
            while (events.length() > MAX_DIAGNOSTIC_EVENTS) {
                events.remove(0);
            }
            getDiagnosticsPrefs().edit().putString(DIAGNOSTICS_EVENTS_KEY, events.toString()).apply();
        } catch (JSONException e) {
            Log.d(TAG, "Unable to persist save failure diagnostic");
        }
    }

    private void recordMediaStoreFailure(String failedStage, String exceptionClass, String format) {
        try {
            JSONArray events = readDiagnosticEvents();
            JSONObject event = new JSONObject();
            event.put("ts", System.currentTimeMillis());
            event.put("source", "native");
            event.put("phase", "MEDIASTORE_SAVE_FAILED");
            event.put("format", format == null ? "other" : format);
            event.put("failedStage", failedStage);
            event.put("exceptionClass", exceptionClass);
            events.put(event);
            while (events.length() > MAX_DIAGNOSTIC_EVENTS) {
                events.remove(0);
            }
            getDiagnosticsPrefs().edit().putString(DIAGNOSTICS_EVENTS_KEY, events.toString()).apply();
        } catch (JSONException e) {
            Log.d(TAG, "Unable to persist MediaStore failure diagnostic");
        }
    }

    private synchronized void recordCallbackDiagnostic(
        String phase,
        Integer resultCode,
        Boolean callPresent,
        Boolean dataPresent,
        String format,
        Long expectedBytes
    ) {
        try {
            JSONArray events = readDiagnosticEvents();
            JSONObject event = new JSONObject();
            event.put("ts", System.currentTimeMillis());
            event.put("source", "native");
            event.put("phase", phase);
            event.put("format", format == null ? "other" : format);
            if (resultCode != null) event.put("resultCode", resultCode);
            if (callPresent != null) event.put("callPresent", callPresent);
            if (dataPresent != null) event.put("dataPresent", dataPresent);
            if (expectedBytes != null) event.put("expectedBytes", expectedBytes);
            events.put(event);
            while (events.length() > MAX_DIAGNOSTIC_EVENTS) {
                events.remove(0);
            }
            getDiagnosticsPrefs().edit().putString(DIAGNOSTICS_EVENTS_KEY, events.toString()).apply();
        } catch (JSONException e) {
            Log.d(TAG, "Unable to persist save callback diagnostic");
        }
    }

    private void rejectIfPossible(PluginCall call, String message) {
        if (call != null) {
            call.reject(message);
        }
    }

    private void rejectIfPossible(PluginCall call, String message, Exception error) {
        if (call != null) {
            call.reject(message, error);
        }
    }

    private String safeMessage(Exception error) {
        String message = error.getMessage();
        return message == null || message.isEmpty() ? error.getClass().getSimpleName() : message;
    }

    private static class PendingSave {
        final File tempFile;
        final Long expectedBytes;
        final String format;

        PendingSave(File tempFile, Long expectedBytes, String format) {
            this.tempFile = tempFile;
            this.expectedBytes = expectedBytes;
            this.format = format;
        }
    }
}
