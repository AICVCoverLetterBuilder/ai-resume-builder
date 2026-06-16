package com.cvproai.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.cvproai.app.plugins.SaveFilePlugin;

import java.util.ArrayList;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        registerPlugin(SaveFilePlugin.class);
    }
}