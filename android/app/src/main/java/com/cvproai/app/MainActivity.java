package com.cvproai.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.cvproai.app.plugins.SaveFilePlugin;
import com.cvproai.app.plugins.PrintPdfPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Custom plugins must be added before BridgeActivity builds the bridge
        // inside super.onCreate(). Registering them afterwards leaves them
        // unavailable to the JavaScript layer.
        registerPlugin(SaveFilePlugin.class);
        registerPlugin(PrintPdfPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
