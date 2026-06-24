package com.cvproai.app.plugins;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;

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
import java.io.OutputStream;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Capacitor plugin for Android Storage Access Framework file saving.
 *
 * The incoming Base64 payload is decoded into an app-cache temporary file
 * before ACTION_CREATE_DOCUMENT is launched. The Activity callback copies from
 * that file instead of depending on PluginCall data surviving the external
 * picker lifecycle.
 */
@CapacitorPlugin(name = "SaveFile")
public class SaveFilePlugin extends Plugin {

    private static final String PLUGIN_VERSION = "1.1.0";
    private static final int BUFFER_SIZE = 8192;

    private final ConcurrentHashMap<String, File> pendingFiles = new ConcurrentHashMap<>();
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
            resolve(call, "failed", "Another file save is already in progress");
            return;
        }

        String callbackId = call.getCallbackId();
        File tempFile = null;

        try {
            String base64Data = call.getString("base64Data");
            String fileName = call.getString("fileName");
            String mimeType = call.getString("mimeType");

            if (base64Data == null || base64Data.isEmpty() ||
                fileName == null || fileName.isEmpty() ||
                mimeType == null || mimeType.isEmpty()) {
                saveInProgress.set(false);
                call.reject("Missing required parameter: base64Data, fileName, or mimeType");
                return;
            }

            byte[] decodedBytes = Base64.decode(base64Data, Base64.DEFAULT);
            if (decodedBytes.length == 0) {
                saveInProgress.set(false);
                call.reject("Decoded file is empty");
                return;
            }

            tempFile = File.createTempFile("cvpro-export-", ".tmp", getContext().getCacheDir());
            try (FileOutputStream output = new FileOutputStream(tempFile)) {
                output.write(decodedBytes);
                output.flush();
            }

            pendingFiles.put(callbackId, tempFile);

            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType(mimeType);
            intent.putExtra(Intent.EXTRA_TITLE, fileName);

            startActivityForResult(call, intent, "handleFileResult");
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

    @ActivityCallback
    public void handleFileResult(PluginCall call, ActivityResult activityResult) {
        String callbackId = call.getCallbackId();
        File tempFile = pendingFiles.remove(callbackId);

        try {
            if (tempFile == null || !tempFile.exists() || tempFile.length() <= 0) {
                resolve(call, "failed", "Prepared file data is unavailable");
                return;
            }

            if (activityResult.getResultCode() == Activity.RESULT_CANCELED) {
                resolve(call, "cancelled", "User cancelled the save dialog");
                return;
            }

            Intent data = activityResult.getData();
            Uri destination = data != null ? data.getData() : null;
            if (activityResult.getResultCode() != Activity.RESULT_OK || destination == null) {
                resolve(call, "failed", "Save was not completed");
                return;
            }

            long bytesWritten = 0;
            try (
                FileInputStream input = new FileInputStream(tempFile);
                OutputStream output = getContext().getContentResolver().openOutputStream(destination, "w")
            ) {
                if (output == null) {
                    resolve(call, "failed", "Could not open destination for writing");
                    return;
                }

                byte[] buffer = new byte[BUFFER_SIZE];
                int count;
                while ((count = input.read(buffer)) != -1) {
                    output.write(buffer, 0, count);
                    bytesWritten += count;
                }
                output.flush();
            }

            if (bytesWritten <= 0) {
                resolve(call, "failed", "No file data was written");
                return;
            }

            resolve(call, "saved", "File saved successfully");
        } catch (IOException | SecurityException e) {
            resolve(call, "failed", "Error writing file: " + safeMessage(e));
        } catch (Exception e) {
            resolve(call, "failed", "Unexpected file-save error: " + safeMessage(e));
        } finally {
            deleteTempFileQuietly(tempFile);
            saveInProgress.set(false);
        }
    }

    private void cleanupPending(String callbackId, File tempFile) {
        if (callbackId != null) {
            pendingFiles.remove(callbackId);
        }
        deleteTempFileQuietly(tempFile);
    }

    private void deleteTempFileQuietly(File file) {
        if (file != null && file.exists()) {
            // Cache files are non-sensitive temporary export data. A failed
            // delete is safe because Android may clear the app cache later.
            //noinspection ResultOfMethodCallIgnored
            file.delete();
        }
    }

    private void resolve(PluginCall call, String resultValue, String message) {
        JSObject result = new JSObject();
        result.put("result", resultValue);
        result.put("message", message);
        call.resolve(result);
    }

    private String safeMessage(Exception error) {
        String message = error.getMessage();
        return message == null || message.isEmpty() ? error.getClass().getSimpleName() : message;
    }
}
