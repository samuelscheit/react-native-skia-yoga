#pragma once

#if __has_include(<NitroModules/JSIConverter.hpp>)
#include <NitroModules/JSIConverter.hpp>
#else
#error NitroModules cannot be found! Are you sure you installed NitroModules properly?
#endif

#include <jsi/jsi.h>

#include "SkiaGlue.hpp"
#include "JsiSkImage.h"

namespace margelo::nitro {

using namespace facebook;

template <>
struct JSIConverter<SkSamplingOptions> final {
  static inline SkSamplingOptions fromJSI(
      jsi::Runtime& runtime,
      const jsi::Value& arg) {
    return RNSkia::SamplingOptionsFromValue(runtime, arg);
  }

  static inline jsi::Value toJSI(
      jsi::Runtime& runtime,
      const SkSamplingOptions& arg) {
    (void)arg;
    return jsi::Object(runtime);
  }

  static inline bool canConvert(jsi::Runtime& runtime, const jsi::Value& value) {
    (void)runtime;
    return value.isObject() || value.isNull() || value.isUndefined();
  }
};

} // namespace margelo::nitro
