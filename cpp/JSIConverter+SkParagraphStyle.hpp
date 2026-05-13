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
#include <cmath>
#include <cstdint>
#include <limits>
#include <string>

namespace margelo::nitro {

using namespace facebook;

namespace {

inline void appendUtf8CodePoint(std::string& output, uint32_t codePoint)
{
  if (codePoint <= 0x7F) {
    output.push_back(static_cast<char>(codePoint));
  } else if (codePoint <= 0x7FF) {
    output.push_back(static_cast<char>(0xC0 | (codePoint >> 6)));
    output.push_back(static_cast<char>(0x80 | (codePoint & 0x3F)));
  } else if (codePoint <= 0xFFFF) {
    output.push_back(static_cast<char>(0xE0 | (codePoint >> 12)));
    output.push_back(static_cast<char>(0x80 | ((codePoint >> 6) & 0x3F)));
    output.push_back(static_cast<char>(0x80 | (codePoint & 0x3F)));
  } else {
    output.push_back(static_cast<char>(0xF0 | (codePoint >> 18)));
    output.push_back(static_cast<char>(0x80 | ((codePoint >> 12) & 0x3F)));
    output.push_back(static_cast<char>(0x80 | ((codePoint >> 6) & 0x3F)));
    output.push_back(static_cast<char>(0x80 | (codePoint & 0x3F)));
  }
}

inline std::string utf16ToUtf8(const std::u16string& input)
{
  std::string output;
  output.reserve(input.size());

  for (size_t index = 0; index < input.size(); ++index) {
    uint32_t codePoint = input[index];
    if (codePoint >= 0xD800 && codePoint <= 0xDBFF) {
      if (index + 1 < input.size()) {
        const auto trailing = static_cast<uint32_t>(input[index + 1]);
        if (trailing >= 0xDC00 && trailing <= 0xDFFF) {
          codePoint =
              0x10000 + (((codePoint - 0xD800) << 10) | (trailing - 0xDC00));
          ++index;
        } else {
          codePoint = 0xFFFD;
        }
      } else {
        codePoint = 0xFFFD;
      }
    } else if (codePoint >= 0xDC00 && codePoint <= 0xDFFF) {
      codePoint = 0xFFFD;
    }

    appendUtf8CodePoint(output, codePoint);
  }

  return output;
}

inline std::string paragraphStyleEllipsisToUtf8(
    const skia::textlayout::ParagraphStyle& paragraphStyle)
{
  auto ellipsis = paragraphStyle.getEllipsis();
  if (!ellipsis.isEmpty()) {
    return std::string(ellipsis.c_str(), ellipsis.size());
  }
  return utf16ToUtf8(paragraphStyle.getEllipsisUtf16());
}

inline size_t getRequiredFiniteParagraphStyleSize(
    jsi::Runtime& runtime,
    const jsi::Object& object,
    const char* key,
    const std::string& propertyPath)
{
  const auto number = getRequiredFiniteStyleNumber(runtime, object, key, propertyPath);
  if (
      std::trunc(number) != number ||
      number < 0.0 ||
      static_cast<long double>(number) >
          static_cast<long double>(std::numeric_limits<size_t>::max())) {
    throwInvalidTextParagraphStyleNumericValue(runtime, propertyPath);
  }
  return static_cast<size_t>(number);
}

inline void validateOptionalParagraphStyleSize(
    jsi::Runtime& runtime,
    const jsi::Object& object,
    const char* key,
    const std::string& propertyPath)
{
  if (object.hasProperty(runtime, key)) {
    (void)getRequiredFiniteParagraphStyleSize(runtime, object, key, propertyPath);
  }
}

inline void validateParagraphStyleFontStyleNumericFields(
    jsi::Runtime& runtime,
    const jsi::Object& object,
    const std::string& stylePath)
{
  if (!object.hasProperty(runtime, "fontStyle")) {
    return;
  }

  auto fontStyle = object.getProperty(runtime, "fontStyle").asObject(runtime);
  validateOptionalStyleInt(runtime, fontStyle, "weight", stylePath + ".fontStyle.weight");
  validateOptionalStyleInt(runtime, fontStyle, "width", stylePath + ".fontStyle.width");
  validateOptionalStyleInt(runtime, fontStyle, "slant", stylePath + ".fontStyle.slant");
}

inline void validateParagraphStyleStrutStyleNumericFields(
    jsi::Runtime& runtime,
    const jsi::Object& object)
{
  if (!object.hasProperty(runtime, "strutStyle")) {
    return;
  }

  auto strutStyle = object.getProperty(runtime, "strutStyle").asObject(runtime);
  validateOptionalStyleFloat(runtime, strutStyle, "fontSize", "ParagraphStyle.strutStyle.fontSize");
  validateOptionalStyleFloat(runtime, strutStyle, "heightMultiplier", "ParagraphStyle.strutStyle.heightMultiplier");
  validateOptionalStyleFloat(runtime, strutStyle, "leading", "ParagraphStyle.strutStyle.leading");
  validateParagraphStyleFontStyleNumericFields(runtime, strutStyle, "ParagraphStyle.strutStyle");
}

inline void validateParagraphStyleNumericFields(
    jsi::Runtime& runtime,
    const jsi::Value& value)
{
  if (value.isUndefined() || value.isNull() || !value.isObject()) {
    return;
  }

  auto object = value.asObject(runtime);
  validateOptionalStyleFloat(runtime, object, "heightMultiplier", "ParagraphStyle.heightMultiplier");
  validateOptionalParagraphStyleSize(runtime, object, "maxLines", "ParagraphStyle.maxLines");
  validateOptionalStyleInt(runtime, object, "textAlign", "ParagraphStyle.textAlign");
  validateOptionalStyleInt(runtime, object, "textDirection", "ParagraphStyle.textDirection");
  validateOptionalStyleInt(runtime, object, "textHeightBehavior", "ParagraphStyle.textHeightBehavior");
  validateParagraphStyleStrutStyleNumericFields(runtime, object);

  if (object.hasProperty(runtime, "textStyle")) {
    auto textStyleValue = object.getProperty(runtime, "textStyle");
    validateTextStyleNumericFields(runtime, textStyleValue, "ParagraphStyle.textStyle");
  }

  bool hasNestedTextStyleHeightMultiplier = false;
  if (object.hasProperty(runtime, "textStyle")) {
    auto textStyleValue = object.getProperty(runtime, "textStyle");
    if (textStyleValue.isObject()) {
      auto textStyleObject = textStyleValue.asObject(runtime);
      hasNestedTextStyleHeightMultiplier = textStyleObject.hasProperty(runtime, "heightMultiplier");
    }
  }

  validateTextStyleNumericFields(
      runtime,
      value,
      "ParagraphStyle",
      hasNestedTextStyleHeightMultiplier);
}

inline jsi::Object paragraphStyleObjectWithoutTextStyle(
    jsi::Runtime& runtime,
    const jsi::Object& object)
{
  jsi::Object paragraphStyle(runtime);
  const char* keys[] = {
      "disableHinting",
      "ellipsis",
      "heightMultiplier",
      "maxLines",
      "replaceTabCharacters",
      "strutStyle",
      "textAlign",
      "textDirection",
      "textHeightBehavior",
  };

  for (const auto* key : keys) {
    if (object.hasProperty(runtime, key)) {
      paragraphStyle.setProperty(runtime, key, object.getProperty(runtime, key));
    }
  }

  return paragraphStyle;
}

inline skia::textlayout::ParagraphStyle paragraphStyleBaseFromValue(
    jsi::Runtime& runtime,
    const jsi::Value& value)
{
  if (!value.isObject()) {
    return RNSkia::JsiSkParagraphStyle::fromValue(runtime, value);
  }

  auto object = value.asObject(runtime);
  auto paragraphStyleObject = paragraphStyleObjectWithoutTextStyle(runtime, object);
  return RNSkia::JsiSkParagraphStyle::fromValue(
      runtime,
      jsi::Value(runtime, paragraphStyleObject));
}

inline void applyNestedParagraphStyleTextStyleOverlay(
    jsi::Runtime& runtime,
    const jsi::Object& object,
    skia::textlayout::ParagraphStyle& paragraphStyle)
{
  if (!object.hasProperty(runtime, "textStyle")) {
    return;
  }

  auto textStyleValue = object.getProperty(runtime, "textStyle");
  auto textStyle = paragraphStyle.getTextStyle();
  applyTextStyle(runtime, textStyleValue, textStyle, false, "ParagraphStyle.textStyle");
  paragraphStyle.setTextStyle(textStyle);
}

inline bool hasNestedParagraphStyleTextStyleHeightMultiplier(
    jsi::Runtime& runtime,
    const jsi::Object& object)
{
  if (!object.hasProperty(runtime, "textStyle")) {
    return false;
  }

  auto textStyleValue = object.getProperty(runtime, "textStyle");
  if (!textStyleValue.isObject()) {
    return false;
  }

  auto textStyleObject = textStyleValue.asObject(runtime);
  return textStyleObject.hasProperty(runtime, "heightMultiplier");
}

inline void applyParagraphStyleStrutStyleOverlay(
    jsi::Runtime& runtime,
    const jsi::Value& value,
    skia::textlayout::ParagraphStyle& paragraphStyle)
{
  auto object = value.asObject(runtime);
  if (!object.hasProperty(runtime, "strutStyle")) {
    return;
  }

  auto strutValue = object.getProperty(runtime, "strutStyle");
  auto strutObject = strutValue.asObject(runtime);
  if (auto families = parseOptionalFontFamilies(runtime, strutObject)) {
    auto strutStyle = paragraphStyle.getStrutStyle();
    strutStyle.setFontFamilies(families.value());
    paragraphStyle.setStrutStyle(strutStyle);
  }
}

inline void rejectUnsupportedParagraphStyleFontVariations(
    jsi::Runtime& runtime,
    const jsi::Value& value)
{
  if (!value.isObject()) {
    return;
  }

  auto object = value.asObject(runtime);
  rejectUnsupportedFontVariations(runtime, object, "ParagraphStyle.fontVariations");

  if (!object.hasProperty(runtime, "textStyle")) {
    return;
  }

  auto textStyleValue = object.getProperty(runtime, "textStyle");
  if (textStyleValue.isObject()) {
    auto textStyleObject = textStyleValue.asObject(runtime);
    rejectUnsupportedFontVariations(
        runtime,
        textStyleObject,
        "ParagraphStyle.textStyle.fontVariations");
  }
}

inline jsi::Object strutStyleToJSI(
    jsi::Runtime& runtime,
    const skia::textlayout::StrutStyle& strutStyle)
{
  jsi::Object object(runtime);
  object.setProperty(runtime, "strutEnabled", strutStyle.getStrutEnabled());
  object.setProperty(
      runtime,
      "fontFamilies",
      textStyleFontFamiliesToJSI(runtime, strutStyle.getFontFamilies()));
  object.setProperty(
      runtime,
      "fontStyle",
      textStyleFontStyleToJSI(runtime, strutStyle.getFontStyle()));
  object.setProperty(runtime, "fontSize", static_cast<double>(strutStyle.getFontSize()));
  if (strutStyle.getHeightOverride()) {
    object.setProperty(runtime, "heightMultiplier", static_cast<double>(strutStyle.getHeight()));
  }
  object.setProperty(runtime, "halfLeading", strutStyle.getHalfLeading());
  object.setProperty(runtime, "leading", static_cast<double>(strutStyle.getLeading()));
  object.setProperty(runtime, "forceStrutHeight", strutStyle.getForceStrutHeight());
  return object;
}

inline bool shouldEmitStrutStyle(const skia::textlayout::StrutStyle& strutStyle)
{
  return !(strutStyle == skia::textlayout::StrutStyle());
}

} // namespace

template <>
struct JSIConverter<skia::textlayout::ParagraphStyle> final {
  static inline skia::textlayout::ParagraphStyle fromJSI(
      jsi::Runtime& runtime,
      const jsi::Value& arg) {
    rejectUnsupportedParagraphStyleFontVariations(runtime, arg);
    validateParagraphStyleNumericFields(runtime, arg);
    auto paragraphStyle = paragraphStyleBaseFromValue(runtime, arg);

    if (arg.isObject()) {
      auto object = arg.asObject(runtime);
      applyNestedParagraphStyleTextStyleOverlay(runtime, object, paragraphStyle);

      // Preserve the flattened JSX API: text-style fields are allowed directly on
      // the paragraphStyle object, and they should accept the same value shapes as
      // <text textStyle={...} />, including CSS color strings. Keep this after
      // the nested overlay so flattened fields retain public precedence.
      auto textStyle = paragraphStyle.getTextStyle();
      applyTextStyle(
          runtime,
          arg,
          textStyle,
          hasNestedParagraphStyleTextStyleHeightMultiplier(runtime, object),
          "ParagraphStyle");
      paragraphStyle.setTextStyle(textStyle);
      applyParagraphStyleStrutStyleOverlay(runtime, arg, paragraphStyle);
    }

    return paragraphStyle;
  }

  static inline jsi::Value toJSI(
      jsi::Runtime& runtime,
      const skia::textlayout::ParagraphStyle& arg) {
    jsi::Object object(runtime);
    object.setProperty(
        runtime,
        "textAlign",
        static_cast<double>(static_cast<int>(arg.getTextAlign())));
    if (!arg.unlimited_lines()) {
      object.setProperty(runtime, "maxLines", static_cast<double>(arg.getMaxLines()));
    }
    if (arg.getHeight() != 0) {
      object.setProperty(runtime, "heightMultiplier", static_cast<double>(arg.getHeight()));
    }
    object.setProperty(runtime, "disableHinting", !arg.hintingIsOn());
    object.setProperty(runtime, "replaceTabCharacters", arg.getReplaceTabCharacters());
    object.setProperty(
        runtime,
        "textDirection",
        static_cast<double>(static_cast<int>(arg.getTextDirection())));
    object.setProperty(
        runtime,
        "textHeightBehavior",
        static_cast<double>(static_cast<int>(arg.getTextHeightBehavior())));

    const auto ellipsis = paragraphStyleEllipsisToUtf8(arg);
    if (!ellipsis.empty()) {
      object.setProperty(runtime, "ellipsis", ellipsis);
    }

    jsi::Object textStyleObject(runtime);
    writeTextStylePublicFieldsToJSI(runtime, textStyleObject, arg.getTextStyle());
    object.setProperty(runtime, "textStyle", textStyleObject);

    writeTextStylePublicFieldsToJSI(runtime, object, arg.getTextStyle(), false);
    const auto& strutStyle = arg.getStrutStyle();
    if (shouldEmitStrutStyle(strutStyle)) {
      object.setProperty(runtime, "strutStyle", strutStyleToJSI(runtime, strutStyle));
    }
    return object;
  }

  static inline bool canConvert(jsi::Runtime& runtime, const jsi::Value& value) {
    (void)runtime;
    return value.isObject() || value.isNull() || value.isUndefined();
  }
};

} // namespace margelo::nitro
