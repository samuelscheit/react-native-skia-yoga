package com.margelo.nitro.skiayoga

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.facebook.react.uimanager.ViewManager

class SkiaYogaPackage : BaseReactPackage() {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
    listOf(SkiaYogaModule(reactContext))

  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
    val module = if (name == SkiaYogaModule.NAME) {
      SkiaYogaModule(reactContext)
    } else {
      null
    }

    return module;
  }

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()

  override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
    mapOf(
      SkiaYogaModule.NAME to ReactModuleInfo(
        name = SkiaYogaModule.NAME,
        className = SkiaYogaModule.NAME,
        canOverrideExistingModule = false,
        needsEagerInit = false,
        isCxxModule = false,
        isTurboModule = true
      )
    )
  }
}
