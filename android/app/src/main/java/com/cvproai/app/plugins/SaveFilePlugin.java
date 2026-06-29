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
    private static final String PENDING_PREFS = "cvpro_pending_save";
    private static final String PENDING_CALLBACK_ID_KEY = "callbackId";
    private static final String PENDING_TEMP_PATH_KEY = "tempPath";
    private static final String PENDING_EXPECTED_BYTES_KEY = "expectedBytes";
    private static final String PENDING_MIME_TYPE_KEY = "mimeType";
    private static final String SAVE_FILE_CALLBACK = "saveFileResult";
    private static final String DOWNLOAD_RELATIVE_PATH = Environment.DIRECTORY_DOWNLOADS + "/CV Pro AI";
    private static final int BUFFER_SIZE = 8192;

    private final ConcurrentHashMap<String, File> pendingFiles = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Long> pendingExpectedBytes = new ConcurrentHashMap<>();
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
    public void saveFile(PluginCall call) {
        if (!saveInProgress.compareAndSet(false, true)) {
            call.reject("Another file save is already in progress");
            return;
        }

        String callbackId = call.getCallbackId();
        File tempFile = null;

        try {
            String base64Data = call.getString("base64Data");
            String fileName = call.getString("fileName");
            String mimeType = call.getString("mimeType");
            Integer expectedBytes = call.getInt("expectedBytes");

            if (base64Data == null || base64Data.isEmpty() ||
                fileName == null || fileName.isEmpty() ||
                mimeType == null || mimeType.isEmpty() ||
                expectedBytes == null || expectedBytes <= 0) {
                saveInProgress.set(false);
                call.reject("Missing required parameter: base64Data, fileName, mimeType, or expectedBytes");
                return;
            }

            byte[] decodedBytes = Base64.decode(base64Data, Base64.DEFAULT);
            if (decodedBytes.length == 0) {
                saveInProgress.set(false);
                call.reject("Decoded file is empty");
                return;
            }
            if (decodedBytes.length != expectedBytes) {
                saveInProgress.set(false);
                call.reject("Decoded file size does not match expected byte count");
                return;
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                saveToMediaStoreDownloads(call, decodedBytes, fileName, mimeType, expectedBytes.longValue());
                return;
            }

            tempFile = File.createTempFile("cvpro-export-", ".tmp", getContext().getCacheDir());
            try (FileOutputStream output = new FileOutputStream(tempFile)) {
                output.write(decodedBytes);
                output.flush();
            }

            pendingFiles.put(callbackId, tempFile);
            pendingExpectedBytes.put(callbackId, Long.valueOf(expectedBytes));
            persistPendingSave(callbackId, tempFile, Long.valueOf(expectedBytes), mimeType);
            Log.d(TAG, "Prepared export payload type=" + safeMimeLabel(mimeType) + " bytes=" + decodedBytes.length);

            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType(mimeType);
            intent.putExtra(Intent.EXTRA_TITLE, fileName);

            startActivityForResult(call, intent, SAVE_FILE_CALLBACK);
        } catch (IllegalArgumentException e) {
            cleanupPending(callbackId, tempFile);
            saveInProgress.set(false);
            call.reject("Invalid Base64 file data", e);
        } catch (IOException | SecurityException e) {
            cleanupPending(callbackId, tempFile);
            saveInProgress.set(false);
            call.reject("Unable to prepare file for saving: " + safeMessage(e), e);
        } catch (Exception e) {
            cleanupPending(callbackId, tempFile);
            saveInProgress.set(false);
            call.reject("Unexpected file-save error: " + safeMessage(e), e);
        }
    }

    private void saveToMediaStoreDownloads(
        PluginCall call,
        byte[] decodedBytes,
        String requestedFileName,
        String mimeType,
        Long expectedBytes
    ) {
        Uri destination = null;
        String finalDisplayName = null;
        long bytesWritten = 0;

        try {
            ContentResolver resolver = getContext().getContentResolver();
            finalDisplayName = makeUniqueDisplayName(resolver, sanitizeDisplayFileName(requestedFileName));

            ContentValues values = new ContentValues();
            values.put(MediaStore.MediaColumns.DISPLAY_NAME, finalDisplayName);
            values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
            values.put(MediaStore.MediaColumns.RELATIVE_PATH, DOWNLOAD_RELATIVE_PATH);
            values.put(MediaStore.MediaColumns.IS_PENDING, 1);

            destination = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (destination == null) {
                call.reject("Could not create Downloads entry");
                return;
            }

            try (ParcelFileDescriptor descriptor = resolver.openFileDescriptor(destination, "rwt")) {
                if (descriptor == null) {
                    deleteDestinationQuietly(destination);
                    call.reject("Could not open Downloads entry for writing");
                    return;
                }

                try (FileOutputStream output = new FileOutputStream(descriptor.getFileDescriptor())) {
                    output.write(decodedBytes);
                    bytesWritten = decodedBytes.length;
                    output.flush();
                    output.getFD().sync();
                }
            }

            long verifiedSize = readBackByteCount(destination);

            if (bytesWritten <= 0 || verifiedSize <= 0) {
                deleteDestinationQuietly(destination);
                call.reject("No file data was written");
                return;
            }

            if (bytesWritten != expectedBytes || verifiedSize != expectedBytes) {
                deleteDestinationQuietly(destination);
                call.reject("Saved file size did not match generated file");
                return;
            }

            ContentValues publishValues = new ContentValues();
            publishValues.put(MediaStore.MediaColumns.IS_PENDING, 0);
            resolver.update(destination, publishValues, null, null);
            resolve(call, "saved", "Saved to Downloads/CV Pro AI", bytesWritten, verifiedSize);
        } catch (IOException | SecurityException e) {
            if (destination != null) {
                deleteDestinationQuietly(destination);
            }
            call.reject("Error writing file: " + safeMessage(e), e);
        } catch (Exception e) {
            if (destination != null) {
                deleteDestinationQuietly(destination);
            }
            call.reject("Unexpected file-save error: " + safeMessage(e), e);
        } finally {
            saveInProgress.set(false);
        }
    }

    @ActivityCallback
    private void saveFileResult(PluginCall call, ActivityResult activityResult) {
        Intent data = activityResult != null ? activityResult.getData() : null;
        Uri destination = data != null ? data.getData() : null;
        boolean callPresent = call != null;
        String callbackId = callPresent ? call.getCallbackId() : null;
        PendingSave pendingSave = recoverPendingSave(callbackId);
        File tempFile = pendingSave != null ? pendingSave.tempFile : null;
        Long expectedBytes = pendingSave != null ? pendingSave.expectedBytes : null;

        try {
            if (activityResult == null) {
                rejectIfPossible(call, "Save result was unavailable");
                return;
            }

            if (activityResult.getResultCode() == Activity.RESULT_CANCELED) {
                if (callPresent) {
                    resolve(call, "cancelled", "User cancelled the save dialog", 0, 0);
                }
                return;
            }

            if (activityResult.getResultCode() != Activity.RESULT_OK || destination == null) {
                rejectIfPossible(call, "Save was not completed");
                return;
            }

            if (!callPresent) {
                deleteDestinationQuietly(destination);
                return;
            }

            if (!isUsablePendingSave(pendingSave)) {
                deleteDestinationQuietly(destination);
                call.reject("Prepared file data is unavailable");
                return;
            }

            long bytesWritten = 0;
            try (
                ParcelFileDescriptor descriptor = getContext().getContentResolver().openFileDescriptor(destination, "rwt");
                FileInputStream input = new FileInputStream(tempFile)
            ) {
                if (descriptor == null) {
                    deleteDestinationQuietly(destination);
                    call.reject("Could not open destination for writing");
                    return;
                }

                try (FileOutputStream output = new FileOutputStream(descriptor.getFileDescriptor())) {
                    byte[] buffer = new byte[BUFFER_SIZE];
                    int count;
                    while ((count = input.read(buffer)) != -1) {
                        output.write(buffer, 0, count);
                        bytesWritten += count;
                    }
                    output.flush();
                    output.getFD().sync();
                }
            }

            long verifiedSize = readBackByteCount(destination);
            Log.d(TAG, "Completed export write bytesWritten=" + bytesWritten + " verifiedSize=" + verifiedSize);

            if (bytesWritten <= 0 || verifiedSize <= 0) {
                deleteDestinationQuietly(destination);
                call.reject("No file data was written");
                return;
            }

            if (bytesWritten != expectedBytes || verifiedSize != expectedBytes) {
                deleteDestinationQuietly(destination);
                call.reject("Saved file size did not match generated file");
                return;
            }

            resolve(call, "saved", "File saved successfully", bytesWritten, verifiedSize);
        } catch (IOException | SecurityException e) {
            if (destination != null) {
                deleteDestinationQuietly(destination);
            }
            rejectIfPossible(call, "Error writing file: " + safeMessage(e), e);
        } catch (Exception e) {
            if (destination != null) {
                deleteDestinationQuietly(destination);
            }
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
        }
        clearPersistedPendingSave();
        deleteTempFileQuietly(tempFile);
    }

    private void persistPendingSave(String callbackId, File tempFile, Long expectedBytes, String mimeType) {
        getPendingPrefs()
            .edit()
            .putString(PENDING_CALLBACK_ID_KEY, callbackId)
            .putString(PENDING_TEMP_PATH_KEY, tempFile.getAbsolutePath())
            .putLong(PENDING_EXPECTED_BYTES_KEY, expectedBytes)
            .putString(PENDING_MIME_TYPE_KEY, mimeType == null ? "" : mimeType)
            .apply();
    }

    private PendingSave recoverPendingSave(String callbackId) {
        if (callbackId != null) {
            File tempFile = pendingFiles.get(callbackId);
            Long expectedBytes = pendingExpectedBytes.get(callbackId);
            PendingSave inMemory = makePendingSave(tempFile, expectedBytes);
            if (inMemory != null) {
                return inMemory;
            }
        }

        SharedPreferences prefs = getPendingPrefs();
        String tempPath = prefs.getString(PENDING_TEMP_PATH_KEY, null);
        long expectedBytes = prefs.getLong(PENDING_EXPECTED_BYTES_KEY, 0L);
        if (tempPath == null || expectedBytes <= 0L) {
            return null;
        }
        File tempFile = new File(tempPath);
        if (!isAppPrivateCacheFile(tempFile)) {
            return null;
        }
        return makePendingSave(tempFile, expectedBytes);
    }

    private PendingSave makePendingSave(File tempFile, Long expectedBytes) {
        if (tempFile == null || expectedBytes == null || expectedBytes <= 0L) {
            return null;
        }
        return new PendingSave(tempFile, expectedBytes);
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
        JSObject result = new JSObject();
        result.put("result", resultValue);
        result.put("message", message);
        result.put("bytesWritten", bytesWritten);
        result.put("verifiedSize", verifiedSize);
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

        PendingSave(File tempFile, Long expectedBytes) {
            this.tempFile = tempFile;
            this.expectedBytes = expectedBytes;
        }
    }
}
