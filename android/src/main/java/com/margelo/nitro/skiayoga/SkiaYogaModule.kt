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

private const val TAG = "SkiaYogaModule"

@ReactModule(name = SkiaYogaModule.NAME)
@OptIn(FrameworkAPI::class)
class SkiaYogaModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  private var installed = false
  private var platformContext: Any? = null

  init {
    RNSkiaYogaOnLoad.initializeNative()
  }

  override fun getName() = NAME

  @ReactMethod(isBlockingSynchronousMethod = true)
  fun install(): Boolean {
    if (installed) return true

    val jsContextHolder = reactContext.javaScriptContextHolder ?: return false
    val runtimePtr = jsContextHolder.get()
    if (runtimePtr == 0L) return false

    val runtimeExecutor: RuntimeExecutor? = ReactNativeSkiaReflection.getRuntimeExecutor(reactContext)
    val catalyst: CatalystInstance? = reactContext.catalystInstance
    val jsCallInvokerHolder = catalyst?.jsCallInvokerHolder as? CallInvokerHolderImpl

    val currentPlatformContext = platformContext ?: ReactNativeSkiaReflection.createPlatformContext(reactContext)?.let {
      platformContext = it
      it
    } ?: return false

    if (runtimeExecutor == null && jsCallInvokerHolder == null) {
      Log.w(TAG, "Skipping install: Could not obtain RuntimeExecutor or JS CallInvoker.")
      return false
    }

    installed = nativeInstall(runtimePtr, runtimeExecutor, jsCallInvokerHolder, currentPlatformContext)
    if (!installed) {
      platformContext = null
    }
    return installed
  }

  override fun invalidate() {
    nativeInvalidate()
    installed = false
    platformContext = null
    super.invalidate()
  }

  companion object {
    const val NAME = "SkiaYogaModule"

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
}

private object ReactNativeSkiaReflection {
  private const val PLATFORM_CONTEXT_CLASS = "com.shopify.reactnative.skia.PlatformContext"
  private const val RN_COMPAT_CLASS = "com.shopify.reactnative.skia.ReactNativeCompatible"

  private val platformContextCtor by lazy {
    runCatching {
      Class.forName(PLATFORM_CONTEXT_CLASS).getConstructor(ReactApplicationContext::class.java)
    }.onFailure {
      Log.w(TAG, "PlatformContext class not found. Did you install @shopify/react-native-skia?")
    }.getOrNull()
  }

  private val runtimeExecutorMethod by lazy {
    runCatching {
      Class.forName(RN_COMPAT_CLASS).getMethod("getRuntimeExecutor", com.facebook.react.bridge.ReactContext::class.java)
    }.onFailure {
      Log.w(TAG, "ReactNativeCompatible class not found. Falling back without runtime executor.")
    }.getOrNull()
  }

  fun createPlatformContext(context: ReactApplicationContext): Any? {
    return platformContextCtor?.newInstance(context)
  }

  fun getRuntimeExecutor(context: ReactApplicationContext): RuntimeExecutor? {
    return runtimeExecutorMethod?.invoke(null, context) as? RuntimeExecutor
  }
}
