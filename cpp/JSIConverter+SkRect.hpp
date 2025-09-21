#pragma once

#if __has_include(<NitroModules/JSIConverter.hpp>)
#include <NitroModules/JSIConverter.hpp>
#else
#error NitroModules cannot be found! Are you sure you installed NitroModules properly?
#endif

#include <jsi/jsi.h>

#include "SkiaGlue.hpp"
#include <include/core/SkRect.h>
#include "JsiSkRect.h"

#include "PlatformContextAccessor.hpp"

namespace margelo::nitro {

using namespace facebook;

// C++ SkRect <> JS RNSkia::JsiSkRect host object or plain object
template <>
struct JSIConverter<SkRect> final {
  static inline SkRect fromJSI(jsi::Runtime& runtime, const jsi::Value& arg) {
    if (!arg.isObject()) {
      throw jsi::JSError(runtime, "SkRect must be an object or JsiSkRect host object");
    }
    return *RNSkia::JsiSkRect::fromValue(runtime, arg);
  }

  static inline jsi::Value toJSI(jsi::Runtime& runtime, const SkRect& rect) {
    auto ctx = margelo::nitro::RNSkiaYoga::GetPlatformContext();
    return RNSkia::JsiSkRect::toValue(runtime, ctx, rect);
  }

  static inline bool canConvert(jsi::Runtime& runtime, const jsi::Value& value) {
    if (!value.isObject()) return false;
    jsi::Object obj = value.getObject(runtime);
    if (obj.isHostObject(runtime)) {
      auto host = obj.asHostObject<RNSkia::JsiSkRect>(runtime);
      if (host) return true;
    }
    const char* keys[] = {"x", "y", "width", "height"};
    for (const char* key : keys) {
      if (!obj.hasProperty(runtime, key)) return false;
      auto prop = obj.getProperty(runtime, key);
      if (!prop.isNumber()) return false;
    }
    return true;
  }
};

} // namespace margelo::nitro
