package com.margelo.nitro.skiayoga;

import android.content.Context;
import android.view.Choreographer;

import com.facebook.jni.HybridData;
import com.facebook.jni.annotations.DoNotStrip;
import com.facebook.react.bridge.ReactContext;
import com.shopify.reactnative.skia.RNSkiaModule;
import com.shopify.reactnative.skia.SkiaBaseView;
import com.shopify.reactnative.skia.SkiaManager;

public class SkiaYogaView extends SkiaBaseView {
    @DoNotStrip
    private final HybridData mHybridData;

    private final Choreographer mChoreographer = Choreographer.getInstance();
    private final Choreographer.FrameCallback mFrameCallback = frameTimeNanos -> {
        boolean shouldContinue = onFrame();
        if (shouldContinue && mFrameLoopRunning) {
            mChoreographer.postFrameCallback(mFrameCallback);
        } else {
            mFrameLoopRunning = false;
        }
    };

    private boolean mFrameLoopRunning = false;

    public SkiaYogaView(Context context) {
        super(context);
        RNSkiaModule skiaModule = ((ReactContext) context).getNativeModule(RNSkiaModule.class);
        mHybridData = initHybrid(skiaModule.getSkiaManager());
    }

    @Override
    protected void finalize() throws Throwable {
        try {
            mHybridData.resetNative();
        } finally {
            super.finalize();
        }
    }

    @Override
    protected void onDetachedFromWindow() {
        stopFrameLoop();
        super.onDetachedFromWindow();
    }

    public void startFrameLoop() {
        post(() -> {
            if (mFrameLoopRunning) {
                return;
            }
            mFrameLoopRunning = true;
            mChoreographer.postFrameCallback(mFrameCallback);
        });
    }

    public void stopFrameLoop() {
        post(() -> {
            if (!mFrameLoopRunning) {
                return;
            }
            mFrameLoopRunning = false;
            mChoreographer.removeFrameCallback(mFrameCallback);
        });
    }

    private native HybridData initHybrid(SkiaManager skiaManager);

    protected native void surfaceAvailable(Object surface, int width, int height, boolean opaque);

    protected native void surfaceSizeChanged(Object surface, int width, int height, boolean opaque);

    protected native void surfaceDestroyed();

    protected native void setDebugMode(boolean show);

    protected native void registerView(int nativeId);

    protected native void unregisterView();

    protected native int[] getBitmap(int width, int height);

    protected native boolean onFrame();
}
