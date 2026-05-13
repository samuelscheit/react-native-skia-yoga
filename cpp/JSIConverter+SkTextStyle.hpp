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
#include <cmath>
#include <limits>
#include <optional>
#include <string>
#include <variant>
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

[[noreturn]] inline void throwInvalidTextParagraphStyleNumericValue(
    jsi::Runtime& runtime,
    const std::string& propertyPath)
{
    throw jsi::JSError(
        runtime,
        "Invalid numeric text/paragraph style value for " + propertyPath +
            ": expected a finite number within native range.");
}

inline double getRequiredFiniteStyleNumber(
    jsi::Runtime& runtime,
    const jsi::Object& object,
    const char* key,
    const std::string& propertyPath)
{
    const auto number = object.getProperty(runtime, key).asNumber();
    if (!std::isfinite(number)) {
        throwInvalidTextParagraphStyleNumericValue(runtime, propertyPath);
    }
    return number;
}

inline bool isFiniteNativeStyleFloat(double number)
{
    return std::isfinite(number) &&
        std::abs(number) <= static_cast<double>(std::numeric_limits<float>::max());
}

inline float getRequiredFiniteStyleFloat(
    jsi::Runtime& runtime,
    const jsi::Object& object,
    const char* key,
    const std::string& propertyPath)
{
    const auto number = getRequiredFiniteStyleNumber(runtime, object, key, propertyPath);
    if (!isFiniteNativeStyleFloat(number)) {
        throwInvalidTextParagraphStyleNumericValue(runtime, propertyPath);
    }
    return static_cast<float>(number);
}

inline int getRequiredFiniteStyleInt(
    jsi::Runtime& runtime,
    const jsi::Object& object,
    const char* key,
    const std::string& propertyPath)
{
    const auto number = getRequiredFiniteStyleNumber(runtime, object, key, propertyPath);
    if (
        std::trunc(number) != number ||
        number < static_cast<double>(std::numeric_limits<int>::min()) ||
        number > static_cast<double>(std::numeric_limits<int>::max())) {
        throwInvalidTextParagraphStyleNumericValue(runtime, propertyPath);
    }
    return static_cast<int>(number);
}

template <typename T>
inline T getRequiredFiniteStyleEnum(
    jsi::Runtime& runtime,
    const jsi::Object& object,
    const char* key,
    const std::string& propertyPath)
{
    return static_cast<T>(getRequiredFiniteStyleInt(runtime, object, key, propertyPath));
}

inline void validateOptionalStyleFloat(
    jsi::Runtime& runtime,
    const jsi::Object& object,
    const char* key,
    const std::string& propertyPath)
{
    if (object.hasProperty(runtime, key)) {
        (void)getRequiredFiniteStyleFloat(runtime, object, key, propertyPath);
    }
}

inline void validateOptionalStyleNumber(
    jsi::Runtime& runtime,
    const jsi::Object& object,
    const char* key,
    const std::string& propertyPath)
{
    if (object.hasProperty(runtime, key)) {
        (void)getRequiredFiniteStyleNumber(runtime, object, key, propertyPath);
    }
}

inline void validateOptionalStyleInt(
    jsi::Runtime& runtime,
    const jsi::Object& object,
    const char* key,
    const std::string& propertyPath)
{
    if (object.hasProperty(runtime, key)) {
        (void)getRequiredFiniteStyleInt(runtime, object, key, propertyPath);
    }
}

inline SkPoint parseFiniteTextStylePoint(
    jsi::Runtime& runtime,
    const jsi::Value& value,
    const std::string& propertyPath)
{
    const auto object = value.asObject(runtime);
    if (object.isHostObject(runtime)) {
        auto point = object.asHostObject<RNSkia::JsiSkPoint>(runtime)->getObject();
        const auto x = point->x();
        const auto y = point->y();
        if (!std::isfinite(x) || !std::isfinite(y)) {
            throwInvalidTextParagraphStyleNumericValue(runtime, propertyPath);
        }
        return *point;
    }

    return SkPoint::Make(
        getRequiredFiniteStyleFloat(runtime, object, "x", propertyPath + ".x"),
        getRequiredFiniteStyleFloat(runtime, object, "y", propertyPath + ".y"));
}

inline void rejectUnsupportedFontVariations(
    jsi::Runtime& runtime,
    const jsi::Object& object,
    const char* path)
{
    if (object.hasProperty(runtime, "fontVariations")) {
        throw jsi::JSError(
            runtime,
            std::string("fontVariations is not supported by react-native-skia-yoga native text styles: ") + path);
    }
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

inline jsi::Array textStyleFontFamiliesToJSI(
    jsi::Runtime& runtime,
    const std::vector<SkString>& families)
{
    jsi::Array array(runtime, families.size());
    for (size_t index = 0; index < families.size(); ++index) {
        array.setValueAtIndex(
            runtime,
            index,
            std::string(families[index].c_str(), families[index].size()));
    }
    return array;
}

inline jsi::Array textStyleFontFeaturesToJSI(
    jsi::Runtime& runtime,
    const std::vector<skia::textlayout::FontFeature>& features)
{
    jsi::Array array(runtime, features.size());
    for (size_t index = 0; index < features.size(); ++index) {
        jsi::Object feature(runtime);
        feature.setProperty(
            runtime,
            "name",
            std::string(features[index].fName.c_str(), features[index].fName.size()));
        feature.setProperty(runtime, "value", static_cast<double>(features[index].fValue));
        array.setValueAtIndex(runtime, index, std::move(feature));
    }
    return array;
}

inline jsi::Object textStyleFontStyleToJSI(
    jsi::Runtime& runtime,
    const SkFontStyle& fontStyle)
{
    jsi::Object object(runtime);
    object.setProperty(runtime, "weight", static_cast<double>(fontStyle.weight()));
    object.setProperty(runtime, "width", static_cast<double>(fontStyle.width()));
    object.setProperty(runtime, "slant", static_cast<double>(fontStyle.slant()));
    return object;
}

inline jsi::Object textStylePointToJSI(
    jsi::Runtime& runtime,
    const SkPoint& point)
{
    jsi::Object object(runtime);
    object.setProperty(runtime, "x", static_cast<double>(point.x()));
    object.setProperty(runtime, "y", static_cast<double>(point.y()));
    return object;
}

inline jsi::Array textStyleShadowsToJSI(
    jsi::Runtime& runtime,
    const std::vector<skia::textlayout::TextShadow>& shadows)
{
    jsi::Array array(runtime, shadows.size());
    for (size_t index = 0; index < shadows.size(); ++index) {
        jsi::Object shadow(runtime);
        shadow.setProperty(runtime, "color", static_cast<double>(shadows[index].fColor));
        shadow.setProperty(runtime, "offset", textStylePointToJSI(runtime, shadows[index].fOffset));
        shadow.setProperty(runtime, "blurRadius", static_cast<double>(shadows[index].fBlurSigma));
        array.setValueAtIndex(runtime, index, std::move(shadow));
    }
    return array;
}

inline std::optional<SkColor> textStyleForegroundColor(
    const skia::textlayout::TextStyle& textStyle)
{
    if (!textStyle.hasForeground()) {
        return std::nullopt;
    }

    auto paintOrID = textStyle.getForegroundPaintOrID();
    if (const auto* paint = std::get_if<SkPaint>(&paintOrID)) {
        return paint->getColor();
    }
    return std::nullopt;
}

inline std::optional<SkColor> textStyleBackgroundColor(
    const skia::textlayout::TextStyle& textStyle)
{
    if (!textStyle.hasBackground()) {
        return std::nullopt;
    }

    auto paintOrID = textStyle.getBackgroundPaintOrID();
    if (const auto* paint = std::get_if<SkPaint>(&paintOrID)) {
        return paint->getColor();
    }
    return std::nullopt;
}

inline void validateTextStyleNumericFields(
    jsi::Runtime& runtime,
    const jsi::Value& value,
    const std::string& stylePath,
    bool skipHeightMultiplier = false)
{
    if (value.isUndefined() || value.isNull()) {
        return;
    }
    if (!value.isObject()) {
        throw jsi::JSError(runtime, "Expected textStyle object.");
    }

    auto object = value.asObject(runtime);
    validateOptionalStyleInt(runtime, object, "decoration", stylePath + ".decoration");
    validateOptionalStyleFloat(runtime, object, "decorationThickness", stylePath + ".decorationThickness");
    validateOptionalStyleInt(runtime, object, "decorationStyle", stylePath + ".decorationStyle");
    validateOptionalStyleFloat(runtime, object, "fontSize", stylePath + ".fontSize");
    if (!skipHeightMultiplier) {
        validateOptionalStyleFloat(runtime, object, "heightMultiplier", stylePath + ".heightMultiplier");
    }
    validateOptionalStyleFloat(runtime, object, "letterSpacing", stylePath + ".letterSpacing");
    validateOptionalStyleFloat(runtime, object, "wordSpacing", stylePath + ".wordSpacing");
    validateOptionalStyleInt(runtime, object, "textBaseline", stylePath + ".textBaseline");

    if (object.hasProperty(runtime, "fontFeatures")) {
        auto features = object.getProperty(runtime, "fontFeatures").asObject(runtime).asArray(runtime);
        const auto size = features.size(runtime);
        for (size_t index = 0; index < size; ++index) {
            auto feature = features.getValueAtIndex(runtime, index).asObject(runtime);
            validateOptionalStyleInt(
                runtime,
                feature,
                "value",
                stylePath + ".fontFeatures[" + std::to_string(index) + "].value");
        }
    }

    if (object.hasProperty(runtime, "fontStyle")) {
        auto fontStyle = object.getProperty(runtime, "fontStyle").asObject(runtime);
        validateOptionalStyleInt(runtime, fontStyle, "weight", stylePath + ".fontStyle.weight");
        validateOptionalStyleInt(runtime, fontStyle, "width", stylePath + ".fontStyle.width");
        validateOptionalStyleInt(runtime, fontStyle, "slant", stylePath + ".fontStyle.slant");
    }

    if (object.hasProperty(runtime, "shadows")) {
        auto shadows = object.getProperty(runtime, "shadows").asObject(runtime).asArray(runtime);
        const auto size = shadows.size(runtime);
        for (size_t index = 0; index < size; ++index) {
            auto shadow = shadows.getValueAtIndex(runtime, index).asObject(runtime);
            validateOptionalStyleNumber(
                runtime,
                shadow,
                "blurRadius",
                stylePath + ".shadows[" + std::to_string(index) + "].blurRadius");
            if (shadow.hasProperty(runtime, "offset")) {
                (void)parseFiniteTextStylePoint(
                    runtime,
                    shadow.getProperty(runtime, "offset"),
                    stylePath + ".shadows[" + std::to_string(index) + "].offset");
            }
        }
    }
}

inline void writeTextStylePublicFieldsToJSI(
    jsi::Runtime& runtime,
    jsi::Object& object,
    const skia::textlayout::TextStyle& textStyle,
    bool includeHeightMultiplier = true)
{
    object.setProperty(runtime, "fontSize", static_cast<double>(textStyle.getFontSize()));
    object.setProperty(runtime, "color", static_cast<double>(textStyle.getColor()));
    object.setProperty(runtime, "fontFamilies", textStyleFontFamiliesToJSI(runtime, textStyle.getFontFamilies()));
    if (const auto backgroundColor = textStyleBackgroundColor(textStyle)) {
        object.setProperty(runtime, "backgroundColor", static_cast<double>(*backgroundColor));
    }
    if (const auto foregroundColor = textStyleForegroundColor(textStyle)) {
        object.setProperty(runtime, "foregroundColor", static_cast<double>(*foregroundColor));
    }
    object.setProperty(runtime, "decoration", static_cast<double>(textStyle.getDecorationType()));
    object.setProperty(runtime, "decorationColor", static_cast<double>(textStyle.getDecorationColor()));
    object.setProperty(runtime, "decorationThickness", static_cast<double>(textStyle.getDecorationThicknessMultiplier()));
    object.setProperty(runtime, "decorationStyle", static_cast<double>(textStyle.getDecorationStyle()));
    if (textStyle.getFontFeatureNumber() > 0) {
        object.setProperty(runtime, "fontFeatures", textStyleFontFeaturesToJSI(runtime, textStyle.getFontFeatures()));
    }
    object.setProperty(runtime, "fontStyle", textStyleFontStyleToJSI(runtime, textStyle.getFontStyle()));
    if (includeHeightMultiplier && textStyle.getHeightOverride()) {
        object.setProperty(runtime, "heightMultiplier", static_cast<double>(textStyle.getHeight()));
    }
    object.setProperty(runtime, "halfLeading", textStyle.getHalfLeading());
    object.setProperty(runtime, "letterSpacing", static_cast<double>(textStyle.getLetterSpacing()));
    object.setProperty(runtime, "wordSpacing", static_cast<double>(textStyle.getWordSpacing()));

    auto locale = textStyle.getLocale();
    if (!locale.isEmpty()) {
        object.setProperty(runtime, "locale", std::string(locale.c_str(), locale.size()));
    }
    if (textStyle.getShadowNumber() > 0) {
        object.setProperty(runtime, "shadows", textStyleShadowsToJSI(runtime, textStyle.getShadows()));
    }
    object.setProperty(runtime, "textBaseline", static_cast<double>(textStyle.getTextBaseline()));
}

inline void applyTextStyle(
    jsi::Runtime& runtime,
    const jsi::Value& value,
    skia::textlayout::TextStyle& textStyle,
    bool skipHeightMultiplier = false,
    const std::string& stylePath = "TextStyle")
{
    if (value.isUndefined() || value.isNull()) {
        return;
    }
    if (!value.isObject()) {
        throw jsi::JSError(runtime, "Expected textStyle object.");
    }

    auto object = value.asObject(runtime);
    rejectUnsupportedFontVariations(runtime, object, "TextStyle.fontVariations");
    validateTextStyleNumericFields(runtime, value, stylePath, skipHeightMultiplier);

    if (auto backgroundPaint = parseOptionalPaint(runtime, object, "backgroundColor")) {
        textStyle.setBackgroundPaint(backgroundPaint.value());
    }
    if (auto color = parseOptionalColor(runtime, object, "color")) {
        textStyle.setColor(color.value());
    }
    if (object.hasProperty(runtime, "decoration")) {
        textStyle.setDecoration(getRequiredFiniteStyleEnum<skia::textlayout::TextDecoration>(
            runtime,
            object,
            "decoration",
            stylePath + ".decoration"));
    }
    if (auto decorationColor = parseOptionalColor(runtime, object, "decorationColor")) {
        textStyle.setDecorationColor(decorationColor.value());
    }
    if (object.hasProperty(runtime, "decorationThickness")) {
        textStyle.setDecorationThicknessMultiplier(getRequiredFiniteStyleFloat(
            runtime,
            object,
            "decorationThickness",
            stylePath + ".decorationThickness"));
    }
    if (object.hasProperty(runtime, "decorationStyle")) {
        textStyle.setDecorationStyle(getRequiredFiniteStyleEnum<skia::textlayout::TextDecorationStyle>(
            runtime,
            object,
            "decorationStyle",
            stylePath + ".decorationStyle"));
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
            auto featureValue = getRequiredFiniteStyleInt(
                runtime,
                feature,
                "value",
                stylePath + ".fontFeatures[" + std::to_string(index) + "].value");
            textStyle.addFontFeature(SkString(name), featureValue);
        }
    }
    if (object.hasProperty(runtime, "fontSize")) {
        textStyle.setFontSize(getRequiredFiniteStyleFloat(
            runtime,
            object,
            "fontSize",
            stylePath + ".fontSize"));
    }
    if (object.hasProperty(runtime, "fontStyle")) {
        auto fontStyle = object.getProperty(runtime, "fontStyle").asObject(runtime);
        auto weight = static_cast<SkFontStyle::Weight>(
            fontStyle.hasProperty(runtime, "weight")
                ? getRequiredFiniteStyleInt(runtime, fontStyle, "weight", stylePath + ".fontStyle.weight")
                : static_cast<double>(SkFontStyle::Weight::kNormal_Weight));
        auto width = static_cast<SkFontStyle::Width>(
            fontStyle.hasProperty(runtime, "width")
                ? getRequiredFiniteStyleInt(runtime, fontStyle, "width", stylePath + ".fontStyle.width")
                : static_cast<double>(SkFontStyle::Width::kNormal_Width));
        auto slant = static_cast<SkFontStyle::Slant>(
            fontStyle.hasProperty(runtime, "slant")
                ? getRequiredFiniteStyleInt(runtime, fontStyle, "slant", stylePath + ".fontStyle.slant")
                : static_cast<double>(SkFontStyle::Slant::kUpright_Slant));
        textStyle.setFontStyle(SkFontStyle(weight, width, slant));
    }
    if (auto foregroundPaint = parseOptionalPaint(runtime, object, "foregroundColor")) {
        textStyle.setForegroundColor(foregroundPaint.value());
    }
    if (!skipHeightMultiplier && object.hasProperty(runtime, "heightMultiplier")) {
        textStyle.setHeight(getRequiredFiniteStyleFloat(
            runtime,
            object,
            "heightMultiplier",
            stylePath + ".heightMultiplier"));
        textStyle.setHeightOverride(true);
    }
    if (object.hasProperty(runtime, "halfLeading")) {
        textStyle.setHalfLeading(object.getProperty(runtime, "halfLeading").getBool());
    }
    if (object.hasProperty(runtime, "letterSpacing")) {
        textStyle.setLetterSpacing(getRequiredFiniteStyleFloat(
            runtime,
            object,
            "letterSpacing",
            stylePath + ".letterSpacing"));
    }
    if (object.hasProperty(runtime, "wordSpacing")) {
        textStyle.setWordSpacing(getRequiredFiniteStyleFloat(
            runtime,
            object,
            "wordSpacing",
            stylePath + ".wordSpacing"));
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
                offset = parseFiniteTextStylePoint(
                    runtime,
                    shadow.getProperty(runtime, "offset"),
                    stylePath + ".shadows[" + std::to_string(index) + "].offset");
            }
            auto blurSigma = shadow.hasProperty(runtime, "blurRadius")
                ? getRequiredFiniteStyleNumber(
                    runtime,
                    shadow,
                    "blurRadius",
                    stylePath + ".shadows[" + std::to_string(index) + "].blurRadius")
                : 0;
            textStyle.addShadow(skia::textlayout::TextShadow(color, offset, blurSigma));
        }
    }
    if (object.hasProperty(runtime, "textBaseline")) {
        textStyle.setTextBaseline(getRequiredFiniteStyleEnum<skia::textlayout::TextBaseline>(
            runtime,
            object,
            "textBaseline",
            stylePath + ".textBaseline"));
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
    jsi::Object object(runtime);
    writeTextStylePublicFieldsToJSI(runtime, object, arg);
    return object;
  }

  static inline bool canConvert(jsi::Runtime& runtime, const jsi::Value& value) {
    (void)runtime;
    return value.isObject() || value.isNull() || value.isUndefined();
  }
};

} // namespace margelo::nitro
