#pragma once

#if __has_include(<NitroModules/JSIConverter.hpp>)
#include <NitroModules/JSIConverter.hpp>
#else
#error NitroModules cannot be found! Are you sure you installed NitroModules properly?
#endif

#include <jsi/jsi.h>

#include "SkiaGlue.hpp"
#include "Drawings.h"

namespace margelo::nitro {

using namespace facebook;

template <>
struct JSIConverter<RNSkia::StrokeOpts> final {
  static inline RNSkia::StrokeOpts fromJSI(
      jsi::Runtime& runtime,
      const jsi::Value& arg) {
    return RNSkia::getPropertyValue<RNSkia::StrokeOpts>(runtime, arg);
  }

  static inline jsi::Value toJSI(
      jsi::Runtime& runtime,
      const RNSkia::StrokeOpts& arg) {
    jsi::Object obj(runtime);
    if (arg.width.has_value()) {
      obj.setProperty(runtime, "width", arg.width.value());
    }
    if (arg.miter_limit.has_value()) {
      obj.setProperty(runtime, "miterLimit", arg.miter_limit.value());
    }
    if (arg.precision.has_value()) {
      obj.setProperty(runtime, "precision", arg.precision.value());
    }
    if (arg.join.has_value()) {
      obj.setProperty(runtime, "join", static_cast<double>(arg.join.value()));
    }
    if (arg.cap.has_value()) {
      obj.setProperty(runtime, "cap", static_cast<double>(arg.cap.value()));
    }
    return obj;
  }

  static inline bool canConvert(jsi::Runtime& runtime, const jsi::Value& value) {
    (void)runtime;
    return value.isObject() || value.isNull() || value.isUndefined();
  }
};

} // namespace margelo::nitro
