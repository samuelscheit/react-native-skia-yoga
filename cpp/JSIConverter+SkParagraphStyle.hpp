#pragma once

#if __has_include(<NitroModules/JSIConverter.hpp>)
#include <NitroModules/JSIConverter.hpp>
#else
#error NitroModules cannot be found! Are you sure you installed NitroModules properly?
#endif

#include <jsi/jsi.h>

#include "SkiaGlue.hpp"
#include "JsiSkParagraphStyle.h"
#include "JSIConverter+SkTextStyle.hpp"

namespace margelo::nitro {

using namespace facebook;

template <>
struct JSIConverter<skia::textlayout::ParagraphStyle> final {
  static inline skia::textlayout::ParagraphStyle fromJSI(
      jsi::Runtime& runtime,
      const jsi::Value& arg) {
    auto paragraphStyle = RNSkia::JsiSkParagraphStyle::fromValue(runtime, arg);

    // Preserve the flattened JSX API: text-style fields are allowed directly on
    // the paragraphStyle object, and they should accept the same value shapes as
    // <text textStyle={...} />, including CSS color strings.
    if (arg.isObject()) {
      auto textStyle = paragraphStyle.getTextStyle();
      applyTextStyle(runtime, arg, textStyle);
      paragraphStyle.setTextStyle(textStyle);
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
