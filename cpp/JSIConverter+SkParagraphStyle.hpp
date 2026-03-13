#pragma once

#if __has_include(<NitroModules/JSIConverter.hpp>)
#include <NitroModules/JSIConverter.hpp>
#else
#error NitroModules cannot be found! Are you sure you installed NitroModules properly?
#endif

#include <jsi/jsi.h>

#include "SkiaGlue.hpp"
#include "JsiSkFontStyle.h"
#include "JsiSkParagraphStyle.h"
#include "JsiSkTextStyle.h"

namespace margelo::nitro {

using namespace facebook;

template <>
struct JSIConverter<skia::textlayout::ParagraphStyle> final {
  static inline skia::textlayout::ParagraphStyle fromJSI(
      jsi::Runtime& runtime,
      const jsi::Value& arg) {
    auto paragraphStyle = RNSkia::JsiSkParagraphStyle::fromValue(runtime, arg);

    // Preserve the existing flattened API where text style fields are passed
    // directly on the paragraphStyle object instead of nested under textStyle.
    if (arg.isObject()) {
      paragraphStyle.setTextStyle(RNSkia::JsiSkTextStyle::fromValue(runtime, arg));
    }

    return paragraphStyle;
  }

  static inline jsi::Value toJSI(
      jsi::Runtime& runtime,
      const skia::textlayout::ParagraphStyle& arg) {
    (void)arg;
    return jsi::Object(runtime);
  }

  static inline bool canConvert(jsi::Runtime& runtime, const jsi::Value& value) {
    (void)runtime;
    return value.isObject() || value.isNull() || value.isUndefined();
  }
};

} // namespace margelo::nitro
