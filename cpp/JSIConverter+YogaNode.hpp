#include "YogaNode.hpp"
#include <jsi/jsi.h>

namespace margelo::nitro {
template <>
struct JSIConverter<std::shared_ptr<margelo::nitro::RNSkiaYoga::YogaNode>> {
  static std::shared_ptr<margelo::nitro::RNSkiaYoga::YogaNode>
  fromJSI(jsi::Runtime& runtime, const jsi::Value& arg) {
    jsi::Object obj = arg.asObject(runtime);
    // getNativeState<T>() IS templated and returns std::shared_ptr<T>
    return obj.getNativeState<margelo::nitro::RNSkiaYoga::YogaNode>(runtime);
  }

  static jsi::Value toJSI(
      jsi::Runtime& runtime,
      const std::shared_ptr<margelo::nitro::RNSkiaYoga::YogaNode>& arg) {
    jsi::Object obj(runtime);
    // setNativeState(...) is NOT templated — pass a NativeState ptr
    obj.setNativeState(
        runtime,
        std::static_pointer_cast<facebook::jsi::NativeState>(arg));
    return obj;
  }

  static bool canConvert(jsi::Runtime& runtime, const jsi::Value& value) {
    if (!value.isObject()) return false;
    jsi::Object obj = value.getObject(runtime);
    // hasNativeState<T>() IS templated
    return obj.hasNativeState<margelo::nitro::RNSkiaYoga::YogaNode>(runtime);
  }
};
} // namespace margelo::nitro

