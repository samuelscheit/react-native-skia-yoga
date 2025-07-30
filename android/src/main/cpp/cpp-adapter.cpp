#include <jni.h>
#include "RNSkiaYogaOnLoad.hpp"

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  return margelo::nitro::RNSkiaYoga::initialize(vm);
}
