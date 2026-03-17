#pragma once

#include <memory>
#include <vector>

#include <fbjni/fbjni.h>
#include <jni.h>

#include "JniSkiaBaseView.h"
#include "JniSkiaManager.h"
#include "RNSkAndroidView.h"
#include "RNSkYogaView.hpp"

namespace margelo::nitro::RNSkiaYoga {

namespace jni = facebook::jni;

class JniSkiaYogaView : public jni::HybridClass<JniSkiaYogaView>,
                        public RNSkia::JniSkiaBaseView {
public:
  static auto constexpr kJavaDescriptor =
      "Lcom/margelo/nitro/skiayoga/SkiaYogaView;";

  static jni::local_ref<jhybriddata>
  initHybrid(jni::alias_ref<jhybridobject> jThis,
             jni::alias_ref<RNSkia::JniSkiaManager::javaobject> skiaManager) {
    return makeCxxInstance(jThis, skiaManager);
  }

  static void registerNatives() {
    registerHybrid(
        {makeNativeMethod("initHybrid", JniSkiaYogaView::initHybrid),
         makeNativeMethod("surfaceAvailable",
                          JniSkiaYogaView::surfaceAvailable),
         makeNativeMethod("surfaceDestroyed",
                          JniSkiaYogaView::surfaceDestroyed),
         makeNativeMethod("surfaceSizeChanged",
                          JniSkiaYogaView::surfaceSizeChanged),
         makeNativeMethod("setDebugMode", JniSkiaYogaView::setDebugMode),
         makeNativeMethod("registerView", JniSkiaYogaView::registerView),
         makeNativeMethod("unregisterView", JniSkiaYogaView::unregisterView),
         makeNativeMethod("getBitmap", JniSkiaYogaView::getBitmap),
         makeNativeMethod("onFrame", JniSkiaYogaView::onFrame)});
  }

protected:
  void surfaceAvailable(jobject surface, int width, int height,
                        bool opaque) override {
    RNSkia::JniSkiaBaseView::surfaceAvailable(surface, width, height, opaque);
  }

  void surfaceSizeChanged(jobject surface, int width, int height,
                          bool opaque) override {
    RNSkia::JniSkiaBaseView::surfaceSizeChanged(surface, width, height, opaque);
  }

  void surfaceDestroyed() override {
    RNSkia::JniSkiaBaseView::surfaceDestroyed();
  }

  void setDebugMode(bool show) override {
    RNSkia::JniSkiaBaseView::setDebugMode(show);
  }

  void registerView(int nativeId) override {
    RNSkia::JniSkiaBaseView::registerView(nativeId);
  }

  void unregisterView() override {
    RNSkia::JniSkiaBaseView::unregisterView();
  }

  jni::local_ref<jni::JArrayInt> getBitmap(int width, int height) override {
    (void)width;
    (void)height;
    return jni::JArrayInt::newArray(0);
  }

  bool onFrame() {
    auto androidView = std::static_pointer_cast<
        RNSkia::RNSkAndroidView<margelo::nitro::RNSkiaYoga::RNSkYogaView>>(
        _skiaAndroidView);
    if (androidView == nullptr) {
      return false;
    }

    auto yogaView = std::dynamic_pointer_cast<RNSkYogaView>(
        androidView->getSkiaView());
    if (yogaView == nullptr) {
      return false;
    }

    return yogaView->onFrame();
  }

private:
  friend HybridBase;

  explicit JniSkiaYogaView(
      jni::alias_ref<jhybridobject> jThis,
      jni::alias_ref<RNSkia::JniSkiaManager::javaobject> skiaManager)
      : RNSkia::JniSkiaBaseView(
            skiaManager,
            std::make_shared<RNSkia::RNSkAndroidView<RNSkYogaView>>(
                skiaManager->cthis()->getPlatformContext())),
        javaPart_(jni::make_global(jThis)) {
    auto androidView =
        std::static_pointer_cast<RNSkia::RNSkAndroidView<RNSkYogaView>>(
            _skiaAndroidView);
    auto yogaView =
        std::dynamic_pointer_cast<RNSkYogaView>(androidView->getSkiaView());
    if (yogaView != nullptr) {
      auto javaPart = javaPart_;
      yogaView->setSchedulerCallbacks(
          [javaPart]() {
            jni::ThreadScope ts;
            static const auto method =
                javaPart->getClass()->getMethod<void()>("startFrameLoop");
            method(javaPart.get());
          },
          [javaPart]() {
            jni::ThreadScope ts;
            static const auto method =
                javaPart->getClass()->getMethod<void()>("stopFrameLoop");
            method(javaPart.get());
          });
    }
  }

  jni::global_ref<javaobject> javaPart_;
};

} // namespace margelo::nitro::RNSkiaYoga
