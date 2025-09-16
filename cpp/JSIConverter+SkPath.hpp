#pragma once

#if __has_include(<NitroModules/JSIConverter.hpp>)
#include <NitroModules/JSIConverter.hpp>
#else
#error NitroModules cannot be found! Are you sure you installed NitroModules properly?
#endif

#include <jsi/jsi.h>

// Skia headers
#include "SkPath.h"
#include <react-native-skia/cpp/api/JsiSkPath.h>
// Access platform context without including SkiaYoga.hpp to avoid include cycles
#include "PlatformContextAccessor.hpp"


namespace margelo::nitro {

using namespace facebook;

// C++ SkPath <> JS RNSkia::JsiSkPath host object
template <>
struct JSIConverter<SkPath> final {
  static inline SkPath fromJSI(jsi::Runtime& runtime, const jsi::Value& arg) {
    if (!arg.isObject()) {
      throw jsi::JSError(runtime, "SkPath must be a host object (JsiSkPath)");
    }
    jsi::Object obj = arg.asObject(runtime);
    if (obj.isHostObject(runtime)) {
      auto host = obj.asHostObject<RNSkia::JsiSkPath>(runtime);
      if (host) {
        return *host->getObject();
      }
    }
    throw jsi::JSError(runtime, "SkPath: unsupported JS value. Expected JsiSkPath host object.");
  }

  static inline jsi::Value toJSI(jsi::Runtime& runtime, const SkPath& path) {
    auto ctx = margelo::nitro::RNSkiaYoga::GetPlatformContext();
    // JsiSkPath::toValue expects an rvalue SkPath, not a shared_ptr
    SkPath copy(path);
    return RNSkia::JsiSkPath::toValue(runtime, ctx, std::move(copy));
  }

  static inline bool canConvert(jsi::Runtime& runtime, const jsi::Value& value) {
    if (!value.isObject()) return false;
    jsi::Object obj = value.getObject(runtime);
    if (!obj.isHostObject(runtime)) return false;
    auto host = obj.asHostObject<RNSkia::JsiSkPath>(runtime);
    return static_cast<bool>(host);
  }
};

} // namespace margelo::nitro
