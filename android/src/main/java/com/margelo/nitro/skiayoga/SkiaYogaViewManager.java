package com.margelo.nitro.skiayoga;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.annotations.ReactProp;
import com.shopify.reactnative.skia.SkiaBaseViewManager;

public class SkiaYogaViewManager extends SkiaBaseViewManager<SkiaYogaView> {
    @NonNull
    @Override
    public String getName() {
        return "SkiaYogaView";
    }

    @NonNull
    @Override
    public SkiaYogaView createViewInstance(@NonNull ThemedReactContext reactContext) {
        return new SkiaYogaView(reactContext);
    }

    @ReactProp(name = "colorSpace")
    public void setColorSpace(SkiaYogaView view, @Nullable String value) {
        // Native view color space is controlled by the underlying Skia surface.
    }
}
