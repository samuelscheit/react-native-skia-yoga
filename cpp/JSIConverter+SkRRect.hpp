#pragma once

#if __has_include(<NitroModules/JSIConverter.hpp>)
#include <NitroModules/JSIConverter.hpp>
#else
#error NitroModules cannot be found! Are you sure you installed NitroModules properly?
#endif

#include <jsi/jsi.h>

#include "SkRRect.h"
#include <react-native-skia/cpp/api/JsiSkRRect.h>
#include <react-native-skia/cpp/api/JsiSkPoint.h>

#include "JSIConverter+SkRect.hpp"
#include "PlatformContextAccessor.hpp"

namespace margelo::nitro {

using namespace facebook;

// C++ SkRRect <> JS RNSkia::JsiSkRRect host object or plain object
template <>
struct JSIConverter<SkRRect> final {
  static inline SkRRect fromJSI(jsi::Runtime& runtime, const jsi::Value& arg) {
    if (!arg.isObject()) {
      throw jsi::JSError(runtime, "SkRRect must be an object or JsiSkRRect host object");
    }
    return *RNSkia::JsiSkRRect::fromValue(runtime, arg);
  }

  static inline jsi::Value toJSI(jsi::Runtime& runtime, const SkRRect& rect) {
    auto ctx = margelo::nitro::RNSkiaYoga::GetPlatformContext();
    return RNSkia::JsiSkRRect::toValue(runtime, ctx, rect);
  }

  static inline bool canConvert(jsi::Runtime& runtime, const jsi::Value& value) {
    if (!value.isObject()) return false;
    jsi::Object obj = value.getObject(runtime);
    if (obj.isHostObject(runtime)) {
      auto host = obj.asHostObject<RNSkia::JsiSkRRect>(runtime);
      if (host) return true;
    }
    if (!obj.hasProperty(runtime, "rect")) return false;
    auto rectValue = obj.getProperty(runtime, "rect");
    if (!JSIConverter<SkRect>::canConvert(runtime, rectValue)) return false;

    auto rxValue = obj.getProperty(runtime, "rx");
    if (!rxValue.isUndefined()) {
      auto ryValue = obj.getProperty(runtime, "ry");
      return rxValue.isNumber() && ryValue.isNumber();
    }

    auto hasCorner = [&](const char* key) {
      if (!obj.hasProperty(runtime, key)) return false;
      auto corner = obj.getProperty(runtime, key);
      if (!corner.isObject()) return false;
      jsi::Object cornerObj = corner.getObject(runtime);
      if (cornerObj.isHostObject(runtime)) {
        auto host = cornerObj.asHostObject<RNSkia::JsiSkPoint>(runtime);
        if (host) return true;
      }
      if (!cornerObj.hasProperty(runtime, "x") || !cornerObj.hasProperty(runtime, "y")) return false;
      auto xProp = cornerObj.getProperty(runtime, "x");
      auto yProp = cornerObj.getProperty(runtime, "y");
      return xProp.isNumber() && yProp.isNumber();
    };

    bool corners = hasCorner("topLeft") && hasCorner("topRight") &&
                   hasCorner("bottomRight") && hasCorner("bottomLeft");
    return corners;
  }
};

} // namespace margelo::nitro
