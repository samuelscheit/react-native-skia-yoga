package com.margelo.nitro.skiayoga

import android.util.Log
import com.facebook.react.bridge.CatalystInstance
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.RuntimeExecutor
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.turbomodule.core.CallInvokerHolderImpl
import com.facebook.react.common.annotations.FrameworkAPI
import com.margelo.nitro.RNSkiaYoga.RNSkiaYogaOnLoad
import com.shopify.reactnative.skia.RNSkiaModule

private const val TAG = "SkiaYoga"

@ReactModule(name = SkiaYogaModule.NAME)
@OptIn(FrameworkAPI::class)
class SkiaYogaModule(private val reactContext: ReactApplicationContext) : NativeSkiaYogaSpec(reactContext) {
  private var installed = false
  private var platformContext: Any? = null

  init {
    RNSkiaYogaOnLoad.initializeNative()
  }

  override fun getName() = NAME

  @ReactMethod(isBlockingSynchronousMethod = true)
  override fun install() {
    if (installed) return

    val jsContextHolder = reactContext.javaScriptContextHolder ?: return
    val runtimePtr = jsContextHolder.get()
    if (runtimePtr == 0L) return

    val catalyst: CatalystInstance? = reactContext.catalystInstance
    val runtimeExecutor: RuntimeExecutor? = catalyst?.runtimeExecutor
    val jsCallInvokerHolder = catalyst?.jsCallInvokerHolder as? CallInvokerHolderImpl

    val currentPlatformContext = platformContext ?: resolvePlatformContextFromSkiaModule()?.also {
      platformContext = it
      it
    } ?: return

    if (runtimeExecutor == null && jsCallInvokerHolder == null) {
      Log.w(TAG, "Skipping install: Could not obtain RuntimeExecutor or JS CallInvoker.")
      return
    }

    installed = nativeInstall(runtimePtr, runtimeExecutor, jsCallInvokerHolder, currentPlatformContext)
    if (!installed) {
      platformContext = null
    }
  }

  override fun invalidate() {
    nativeInvalidate()
    installed = false
    platformContext = null
    super.invalidate()
  }

  companion object {
    const val NAME = "SkiaYoga"

    @JvmStatic
    private external fun nativeInstall(
      jsRuntimePtr: Long,
      runtimeExecutor: RuntimeExecutor?,
      jsCallInvokerHolder: CallInvokerHolderImpl?,
      platformContext: Any
    ): Boolean

    @JvmStatic
    private external fun nativeInvalidate()
  }


  private fun resolvePlatformContextFromSkiaModule(): Any? {
    val rnSkiaModule = reactContext.getNativeModule(RNSkiaModule::class.java)
    if (rnSkiaModule == null) {
      Log.w(TAG, "Skipping install: RNSkiaModule not available. Did you install @shopify/react-native-skia?")
      return null
    }

    var skiaManager = rnSkiaModule.skiaManager
    if (skiaManager == null && !rnSkiaModule.install()) {
      Log.w(TAG, "Skipping install: Failed to initialize RNSkiaModule.")
      return null
    }

    skiaManager = rnSkiaModule.skiaManager
    if (skiaManager == null) {
      Log.w(TAG, "Skipping install: SkiaManager still null after install.")
      return null
    }

    val platformContext = skiaManager.platformContext ?: run {
      Log.w(TAG, "Skipping install: PlatformContext not available from SkiaManager.")
      return null
    }

    return platformContext
  }
}
