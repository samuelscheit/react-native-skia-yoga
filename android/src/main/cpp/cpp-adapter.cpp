#include <jni.h>
#include "RNSkiaYogaOnLoad.hpp"
#include "JniSkiaYogaView.h"

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  auto result = margelo::nitro::RNSkiaYoga::initialize(vm);
  if (result == JNI_ERR) {
    return result;
  }

  margelo::nitro::RNSkiaYoga::JniSkiaYogaView::registerNatives();
  return result;
}
