#pragma once

#if __has_include(<NitroModules/JSIConverter.hpp>)
#include <NitroModules/JSIConverter.hpp>
#else
#error NitroModules cannot be found! Are you sure you installed NitroModules properly?
#endif

#include <jsi/jsi.h>

#include "JsiSkColor.h"
#include "JsiSkTextStyle.h"
#include "JsiSkPoint.h"
#include "SkiaGlue.hpp"
#include <optional>
#include <string>
#include <vector>

namespace margelo::nitro {

using namespace facebook;

namespace {

inline std::optional<SkColor> parseOptionalColor(jsi::Runtime& runtime, const jsi::Object& object, const char* key)
{
    if (!object.hasProperty(runtime, key)) {
        return std::nullopt;
    }

    auto value = object.getProperty(runtime, key);
    if (value.isUndefined() || value.isNull()) {
        return std::nullopt;
    }

    if (value.isString()) {
        auto css = value.asString(runtime).utf8(runtime);
        auto parsed = CSSColorParser::parse(css);
        if (parsed.a == -1.0f) {
            throw jsi::JSError(runtime, "Invalid color string for text style: " + css);
        }
        return SkColorSetARGB(parsed.a * 255, parsed.r, parsed.g, parsed.b);
    }

    if (value.isNumber()) {
        return static_cast<SkColor>(value.asNumber());
    }

    return RNSkia::JsiSkColor::fromValue(runtime, value);
}

inline std::optional<SkPaint> parseOptionalPaint(jsi::Runtime& runtime, const jsi::Object& object, const char* key)
{
    auto color = parseOptionalColor(runtime, object, key);
    if (!color.has_value()) {
        return std::nullopt;
    }

    SkPaint paint;
    paint.setColor(color.value());
    return paint;
}

inline std::optional<std::vector<SkString>> parseOptionalFontFamilies(jsi::Runtime& runtime, const jsi::Object& object)
{
    if (!object.hasProperty(runtime, "fontFamilies")) {
        return std::nullopt;
    }

    auto familiesValue = object.getProperty(runtime, "fontFamilies");
    if (familiesValue.isUndefined() || familiesValue.isNull()) {
        return std::nullopt;
    }

    auto array = familiesValue.asObject(runtime).asArray(runtime);
    std::vector<SkString> families;
    const auto size = array.size(runtime);
    families.reserve(size);
    for (size_t index = 0; index < size; ++index) {
        families.emplace_back(array.getValueAtIndex(runtime, index).asString(runtime).utf8(runtime).c_str());
    }
    return families;
}

inline void applyTextStyle(jsi::Runtime& runtime, const jsi::Value& value, skia::textlayout::TextStyle& textStyle)
{
    if (value.isUndefined() || value.isNull()) {
        return;
    }
    if (!value.isObject()) {
        throw jsi::JSError(runtime, "Expected textStyle object.");
    }

    auto object = value.asObject(runtime);

    if (auto backgroundPaint = parseOptionalPaint(runtime, object, "backgroundColor")) {
        textStyle.setBackgroundPaint(backgroundPaint.value());
    }
    if (auto color = parseOptionalColor(runtime, object, "color")) {
        textStyle.setColor(color.value());
    }
    if (object.hasProperty(runtime, "decoration")) {
        textStyle.setDecoration(static_cast<skia::textlayout::TextDecoration>(object.getProperty(runtime, "decoration").asNumber()));
    }
    if (auto decorationColor = parseOptionalColor(runtime, object, "decorationColor")) {
        textStyle.setDecorationColor(decorationColor.value());
    }
    if (object.hasProperty(runtime, "decorationThickness")) {
        textStyle.setDecorationThicknessMultiplier(object.getProperty(runtime, "decorationThickness").asNumber());
    }
    if (object.hasProperty(runtime, "decorationStyle")) {
        textStyle.setDecorationStyle(static_cast<skia::textlayout::TextDecorationStyle>(object.getProperty(runtime, "decorationStyle").asNumber()));
    }
    if (auto families = parseOptionalFontFamilies(runtime, object)) {
        textStyle.setFontFamilies(families.value());
    }
    if (object.hasProperty(runtime, "fontFeatures")) {
        auto features = object.getProperty(runtime, "fontFeatures").asObject(runtime).asArray(runtime);
        textStyle.resetFontFeatures();
        const auto size = features.size(runtime);
        for (size_t index = 0; index < size; ++index) {
            auto feature = features.getValueAtIndex(runtime, index).asObject(runtime);
            auto name = feature.getProperty(runtime, "name").asString(runtime).utf8(runtime);
            auto featureValue = feature.getProperty(runtime, "value").asNumber();
            textStyle.addFontFeature(SkString(name), featureValue);
        }
    }
    if (object.hasProperty(runtime, "fontSize")) {
        textStyle.setFontSize(object.getProperty(runtime, "fontSize").asNumber());
    }
    if (object.hasProperty(runtime, "fontStyle")) {
        auto fontStyle = object.getProperty(runtime, "fontStyle").asObject(runtime);
        auto weight = static_cast<SkFontStyle::Weight>(
            fontStyle.hasProperty(runtime, "weight")
                ? fontStyle.getProperty(runtime, "weight").asNumber()
                : static_cast<double>(SkFontStyle::Weight::kNormal_Weight));
        auto width = static_cast<SkFontStyle::Width>(
            fontStyle.hasProperty(runtime, "width")
                ? fontStyle.getProperty(runtime, "width").asNumber()
                : static_cast<double>(SkFontStyle::Width::kNormal_Width));
        auto slant = static_cast<SkFontStyle::Slant>(
            fontStyle.hasProperty(runtime, "slant")
                ? fontStyle.getProperty(runtime, "slant").asNumber()
                : static_cast<double>(SkFontStyle::Slant::kUpright_Slant));
        textStyle.setFontStyle(SkFontStyle(weight, width, slant));
    }
    if (auto foregroundPaint = parseOptionalPaint(runtime, object, "foregroundColor")) {
        textStyle.setForegroundColor(foregroundPaint.value());
    }
    if (object.hasProperty(runtime, "heightMultiplier")) {
        textStyle.setHeight(object.getProperty(runtime, "heightMultiplier").asNumber());
        textStyle.setHeightOverride(true);
    }
    if (object.hasProperty(runtime, "halfLeading")) {
        textStyle.setHalfLeading(object.getProperty(runtime, "halfLeading").getBool());
    }
    if (object.hasProperty(runtime, "letterSpacing")) {
        textStyle.setLetterSpacing(object.getProperty(runtime, "letterSpacing").asNumber());
    }
    if (object.hasProperty(runtime, "wordSpacing")) {
        textStyle.setWordSpacing(object.getProperty(runtime, "wordSpacing").asNumber());
    }
    if (object.hasProperty(runtime, "locale")) {
        textStyle.setLocale(SkString(object.getProperty(runtime, "locale").asString(runtime).utf8(runtime)));
    }
    if (object.hasProperty(runtime, "shadows")) {
        auto shadows = object.getProperty(runtime, "shadows").asObject(runtime).asArray(runtime);
        textStyle.resetShadows();
        const auto size = shadows.size(runtime);
        for (size_t index = 0; index < size; ++index) {
            auto shadow = shadows.getValueAtIndex(runtime, index).asObject(runtime);
            auto color = shadow.hasProperty(runtime, "color")
                ? parseOptionalColor(runtime, shadow, "color").value_or(SK_ColorBLACK)
                : SK_ColorBLACK;
            SkPoint offset = SkPoint::Make(0, 0);
            if (shadow.hasProperty(runtime, "offset")) {
                offset = *RNSkia::JsiSkPoint::fromValue(runtime, shadow.getProperty(runtime, "offset")).get();
            }
            auto blurSigma = shadow.hasProperty(runtime, "blurRadius")
                ? shadow.getProperty(runtime, "blurRadius").asNumber()
                : 0;
            textStyle.addShadow(skia::textlayout::TextShadow(color, offset, blurSigma));
        }
    }
    if (object.hasProperty(runtime, "textBaseline")) {
        textStyle.setTextBaseline(static_cast<skia::textlayout::TextBaseline>(object.getProperty(runtime, "textBaseline").asNumber()));
    }
}

} // namespace

template <>
struct JSIConverter<skia::textlayout::TextStyle> final {
  static inline skia::textlayout::TextStyle fromJSI(
      jsi::Runtime& runtime,
      const jsi::Value& arg) {
    skia::textlayout::TextStyle textStyle;
    applyTextStyle(runtime, arg, textStyle);
    return textStyle;
  }

  static inline jsi::Value toJSI(
      jsi::Runtime& runtime,
      const skia::textlayout::TextStyle& arg) {
    (void)arg;
    return jsi::Object(runtime);
  }

  static inline bool canConvert(jsi::Runtime& runtime, const jsi::Value& value) {
    (void)runtime;
    return value.isObject() || value.isNull() || value.isUndefined();
  }
};

} // namespace margelo::nitro
