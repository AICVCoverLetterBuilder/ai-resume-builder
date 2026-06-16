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

import java.io.IOException;
import java.io.OutputStream;

/**
 * SaveFilePlugin — Capacitor plugin for Android Storage Access Framework
 * file saving via ACTION_CREATE_DOCUMENT.
 *
 * Shows the system "Save to…" picker so the user chooses filename and location.
 * Returns "saved", "cancelled", or "failed".
 *
 * Used by the CV / Cover Letter PDF and DOCX export flow on Android.
 */
@CapacitorPlugin(name = "SaveFile")
public class SaveFilePlugin extends Plugin {

    @PluginMethod
    public void saveFile(PluginCall call) {
        String base64Data = call.getString("base64Data");
        String fileName = call.getString("fileName");
        String mimeType = call.getString("mimeType");

        if (base64Data == null || fileName == null || mimeType == null) {
            call.reject("Missing required parameter: base64Data, fileName, or mimeType");
            return;
        }

        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(mimeType);
        intent.putExtra(Intent.EXTRA_TITLE, fileName);

        startActivityForResult(call, intent, "handleFileResult");
    }

    @ActivityCallback
    public void handleFileResult(PluginCall call, ActivityResult result) {
        if (result.getResultCode() == Activity.RESULT_CANCELED) {
            JSObject ret = new JSObject();
            ret.put("result", "cancelled");
            ret.put("message", "User cancelled the save dialog");
            call.resolve(ret);
            return;
        }

        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            JSObject ret = new JSObject();
            ret.put("result", "failed");
            ret.put("message", "Save was not completed");
            call.resolve(ret);
            return;
        }

        Uri uri = result.getData().getData();
        String base64Data = call.getString("base64Data");
        if (base64Data == null) {
            JSObject ret = new JSObject();
            ret.put("result", "failed");
            ret.put("message", "Internal error: data lost");
            call.resolve(ret);
            return;
        }

        byte[] decodedBytes = Base64.decode(base64Data, Base64.DEFAULT);

        try (OutputStream os = getContext().getContentResolver().openOutputStream(uri)) {
            if (os == null) {
                JSObject ret = new JSObject();
                ret.put("result", "failed");
                ret.put("message", "Could not open file for writing");
                call.resolve(ret);
                return;
            }
            os.write(decodedBytes);
            os.flush();

            JSObject ret = new JSObject();
            ret.put("result", "saved");
            ret.put("message", "File saved successfully");
            call.resolve(ret);
        } catch (IOException e) {
            JSObject ret = new JSObject();
            ret.put("result", "failed");
            ret.put("message", "Error writing file: " + e.getMessage());
            call.resolve(ret);
        }
    }
}