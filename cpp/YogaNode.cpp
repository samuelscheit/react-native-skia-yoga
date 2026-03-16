#include "YogaNode.hpp"
#include "ColorParser.hpp"
#include "HybridSkiaYogaSpec.hpp"
#include "HybridYogaNodeSpec.hpp"
#include <include/core/SkColor.h>
#include "SkiaYoga.hpp"
#include <array>
#include <cmath>
#include <jsi/jsi.h>
#include <optional>
#include "JsiSkCanvas.h"
#include "JsiSkFontMgr.h"
#include "JsiSkFontMgrFactory.h"
#include "JsiSkTextStyle.h"
#include "JsiSkHostObjects.h"
#include "JsiSkMatrix.h"
#include "JsiSkTextStyle.h"
#include <include/core/SkPictureRecorder.h>
#include <include/core/SkSurface.h>
#include "DrawingCtx.h"
#include "RNSkManager.h"
#include "RuntimeAwareCache.h"
#include <modules/skparagraph/include/FontCollection.h>
#include <modules/skparagraph/include/ParagraphBuilder.h>
#include <modules/skparagraph/include/ParagraphStyle.h>
#include <type_traits>
#include <variant>
#include <yoga/Yoga.h>

namespace margelo::nitro::RNSkiaYoga {

using namespace facebook;

namespace {

template <typename Tuple, std::size_t... Indices>
std::array<SkScalar, sizeof...(Indices)> tupleToScalarArrayImpl(const Tuple& tuple, std::index_sequence<Indices...>)
{
    return { static_cast<SkScalar>(std::get<Indices>(tuple))... };
}

template <typename Tuple>
auto tupleToScalarArray(const Tuple& tuple)
{
    return tupleToScalarArrayImpl(
        tuple,
        std::make_index_sequence<std::tuple_size_v<std::decay_t<Tuple>>> {});
}

template <typename MatrixStyleValue>
std::shared_ptr<SkMatrix> makeMatrixPointer(const MatrixStyleValue& matrixValue)
{
    return std::visit(
        [](const auto& value) -> std::shared_ptr<SkMatrix> {
            using T = std::decay_t<decltype(value)>;

            if constexpr (std::is_same_v<T, std::shared_ptr<SkMatrix>>) {
                return value;
            } else if constexpr (std::tuple_size_v<T> == 9) {
                const auto values = tupleToScalarArray(value);
                auto matrix = std::make_shared<SkMatrix>();
                matrix->set9(values.data());
                return matrix;
            } else if constexpr (std::tuple_size_v<T> == 16) {
                const auto values = tupleToScalarArray(value);
                return std::make_shared<SkMatrix>(SkM44::RowMajor(values.data()).asM33());
            } else {
                static_assert(std::tuple_size_v<T> == 9 || std::tuple_size_v<T> == 16, "Unsupported matrix tuple size");
            }
        },
        matrixValue);
}

} // namespace

std::optional<SkFont> TextCmd::sDefaultFont;
std::mutex ParagraphCmd::sParagraphBuilderMutex;
std::unique_ptr<para::ParagraphBuilder> ParagraphCmd::sDefaultParagraphBuilder;
sk_sp<para::FontCollection> ParagraphCmd::sDefaultFontCollection;
std::optional<para::ParagraphStyle> ParagraphCmd::sDefaultParagraphStyle;

namespace {

RNSkia::StrokeOpts toNativeStrokeOpts(const PathCommandData::StrokeOptsData& stroke)
{
    RNSkia::StrokeOpts nativeStroke;
    nativeStroke.width = stroke.width;
    nativeStroke.miter_limit = stroke.miterLimit;
    nativeStroke.precision = stroke.precision;
    nativeStroke.join = stroke.join;
    nativeStroke.cap = stroke.cap;
    return nativeStroke;
}

float getNumericProperty(jsi::Runtime& runtime, const jsi::Object& object, const char* key, float fallback)
{
    if (!object.hasProperty(runtime, key)) {
        return fallback;
    }

    const auto value = object.getProperty(runtime, key);
    if (!value.isNumber()) {
        return fallback;
    }

    return static_cast<float>(value.asNumber());
}

PointerEventsMode parsePointerEventsMode(const std::string& value)
{
    if (value == "none") {
        return PointerEventsMode::NONE;
    }
    if (value == "box-only") {
        return PointerEventsMode::BOX_ONLY;
    }
    if (value == "box-none") {
        return PointerEventsMode::BOX_NONE;
    }
    return PointerEventsMode::AUTO;
}

std::string describeJSIValue(jsi::Runtime& runtime, const jsi::Value& value, int depth = 0)
{
    if (value.isUndefined()) {
        return "undefined";
    }
    if (value.isNull()) {
        return "null";
    }
    if (value.isBool()) {
        return value.getBool() ? "true" : "false";
    }
    if (value.isNumber()) {
        return std::to_string(value.asNumber());
    }
    if (value.isString()) {
        return "\"" + value.asString(runtime).utf8(runtime) + "\"";
    }
    if (!value.isObject()) {
        return "[unknown]";
    }

    auto object = value.asObject(runtime);
    if (object.isArray(runtime)) {
        auto array = object.asArray(runtime);
        if (depth >= 1) {
            return "[Array(" + std::to_string(array.size(runtime)) + ")]";
        }

        std::string result = "[";
        const auto length = std::min<size_t>(array.size(runtime), 5);
        for (size_t index = 0; index < length; ++index) {
            if (index > 0) {
                result += ", ";
            }
            result += describeJSIValue(runtime, array.getValueAtIndex(runtime, index), depth + 1);
        }
        if (array.size(runtime) > length) {
            result += ", ...";
        }
        result += "]";
        return result;
    }

    if (depth >= 2) {
        return "[Object]";
    }

    auto propertyNames = object.getPropertyNames(runtime);
    std::string result = "{";
    const auto length = std::min<size_t>(propertyNames.size(runtime), 8);
    for (size_t index = 0; index < length; ++index) {
        if (index > 0) {
            result += ", ";
        }

        const auto keyValue = propertyNames.getValueAtIndex(runtime, index);
        const auto key = keyValue.isString() ? keyValue.asString(runtime).utf8(runtime) : "<non-string>";
        result += key + ": ";
        result += describeJSIValue(runtime, object.getProperty(runtime, key.c_str()), depth + 1);
    }
    if (propertyNames.size(runtime) > length) {
        result += ", ...";
    }
    result += "}";
    return result;
}

} // namespace

YogaNode::~YogaNode()
{
    if (_node != nullptr) {
        YGNodeFree(_node);
        _node = nullptr;
    }
}

YogaNode::YogaNode()
    : HybridObject(HybridYogaNodeSpec::TAG)
{
    _node = YGNodeNew();
    YGNodeSetContext(_node, this);
}

// Helper function to handle variant<string, double> values dfor setting yoga values
static void setYGValueOrPercent(void (*setter)(YGNodeRef, float),
    void (*percentSetter)(YGNodeRef, float),
    void (*autoSetter)(YGNodeRef),
    YGNodeRef node,
    const std::variant<std::string, double>& value)
{
    if (std::holds_alternative<std::string>(value)) {
        const std::string& strValue = std::get<std::string>(value);
        if (strValue == "auto" && autoSetter) {
            autoSetter(node);
        } else if (!strValue.empty() && strValue.back() == '%' && percentSetter) {
            // Optimized percentage parsing - avoid substr allocation
            float percent = std::stof(std::string(strValue.data(), strValue.length() - 1));
            percentSetter(node, percent);
        }
    } else {
        float numValue = static_cast<float>(std::get<double>(value));
        setter(node, numValue);
    }
}

// Helper function for edge-based properties (margin, padding, etc.)
static void setYGEdgeValue(void (*setter)(YGNodeRef, YGEdge, float),
    void (*percentSetter)(YGNodeRef, YGEdge, float),
    void (*autoSetter)(YGNodeRef, YGEdge),
    YGNodeRef node,
    YGEdge edge,
    const std::variant<std::string, double>& value)
{
    if (std::holds_alternative<std::string>(value)) {
        const std::string& strValue = std::get<std::string>(value);
        if (strValue == "auto" && autoSetter) {
            autoSetter(node, edge);
        } else if (!strValue.empty() && strValue.back() == '%' && percentSetter) {
            // Optimized percentage parsing - avoid substr allocation
            float percent = std::stof(std::string(strValue.data(), strValue.length() - 1));
            percentSetter(node, edge, percent);
        }
    } else {
        float numValue = static_cast<float>(std::get<double>(value));
        setter(node, edge, numValue);
    }
}

void YogaNode::setStyle(const NodeStyle& style)
{
    invalidateLayout();
    _style = style;

    // Layout properties - using references to avoid multiple value() calls
    if (const auto& value = style.justifyContent) {
        YGNodeStyleSetJustifyContent(_node, static_cast<YGJustify>(*value));
    }

    if (const auto& value = style.alignItems) {
        YGNodeStyleSetAlignItems(_node, static_cast<YGAlign>(*value));
    }

    if (const auto& value = style.alignSelf) {
        YGNodeStyleSetAlignSelf(_node, static_cast<YGAlign>(*value));
    }

    if (const auto& value = style.alignContent) {
        YGNodeStyleSetAlignContent(_node, static_cast<YGAlign>(*value));
    }

    if (const auto& value = style.flexDirection) {
        YGNodeStyleSetFlexDirection(_node, static_cast<YGFlexDirection>(*value));
    }

    if (const auto& value = style.flexWrap) {
        YGNodeStyleSetFlexWrap(_node, static_cast<YGWrap>(*value));
    }

    if (const auto& value = style.display) {
        YGNodeStyleSetDisplay(_node, static_cast<YGDisplay>(*value));
    }

    if (const auto& value = style.direction) {
        YGNodeStyleSetDirection(_node, static_cast<YGDirection>(*value));
    }

    if (const auto& value = style.position) {
        YGNodeStyleSetPositionType(_node, static_cast<YGPositionType>(*value));
    }

    if (const auto& value = style.overflow) {
        YGNodeStyleSetOverflow(_node, static_cast<YGOverflow>(*value));
    }

    if (const auto& value = style.boxSizing) {
        YGNodeStyleSetBoxSizing(_node, static_cast<YGBoxSizing>(*value));
    }

    // Flex properties
    if (const auto& value = style.flex) {
        YGNodeStyleSetFlex(_node, static_cast<float>(*value));
    }

    if (const auto& value = style.flexGrow) {
        YGNodeStyleSetFlexGrow(_node, static_cast<float>(*value));
    }

    if (const auto& value = style.flexShrink) {
        YGNodeStyleSetFlexShrink(_node, static_cast<float>(*value));
    }

    if (const auto& value = style.flexBasis) {
        setYGValueOrPercent(YGNodeStyleSetFlexBasis, YGNodeStyleSetFlexBasisPercent,
            YGNodeStyleSetFlexBasisAuto, _node, *value);
    }

    // Size properties
    if (const auto& value = style.width) {
        if (std::holds_alternative<std::string>(*value)) {
            const auto& s = std::get<std::string>(*value);
            if (s == "fit-content") {
                YGNodeStyleSetWidthFitContent(_node);
            } else if (s == "max-content") {
                YGNodeStyleSetWidthMaxContent(_node);
            } else if (s == "stretch") {
                YGNodeStyleSetWidthStretch(_node);
            } else {
                setYGValueOrPercent(YGNodeStyleSetWidth, YGNodeStyleSetWidthPercent,
                    YGNodeStyleSetWidthAuto, _node, *value);
            }
        } else {
            setYGValueOrPercent(YGNodeStyleSetWidth, YGNodeStyleSetWidthPercent,
                YGNodeStyleSetWidthAuto, _node, *value);
        }
    } else if (_commandKind == YogaNodeCommandKind::PARAGRAPH) {
        // default width for paragraphs is to stretch but not beyond
        YGNodeStyleSetWidthStretch(_node);
    }

    if (const auto& value = style.height) {
        setYGValueOrPercent(YGNodeStyleSetHeight, YGNodeStyleSetHeightPercent,
            YGNodeStyleSetHeightAuto, _node, *value);
    }

    if (const auto& value = style.minWidth) {
        setYGValueOrPercent(YGNodeStyleSetMinWidth, YGNodeStyleSetMinWidthPercent,
            nullptr, _node, *value);
    }

    if (const auto& value = style.minHeight) {
        setYGValueOrPercent(YGNodeStyleSetMinHeight, YGNodeStyleSetMinHeightPercent,
            nullptr, _node, *value);
    }

    if (const auto& value = style.maxWidth) {
        setYGValueOrPercent(YGNodeStyleSetMaxWidth, YGNodeStyleSetMaxWidthPercent,
            nullptr, _node, *value);
    }

    if (const auto& value = style.maxHeight) {
        setYGValueOrPercent(YGNodeStyleSetMaxHeight, YGNodeStyleSetMaxHeightPercent,
            nullptr, _node, *value);
    }

    // Aspect ratio
    if (const auto& value = style.aspectRatio) {
        YGNodeStyleSetAspectRatio(_node, static_cast<float>(*value));
    }

    // Position properties
    if (const auto& value = style.top) {
        setYGEdgeValue(YGNodeStyleSetPosition, YGNodeStyleSetPositionPercent,
            YGNodeStyleSetPositionAuto, _node, YGEdgeTop, *value);
    }

    if (const auto& value = style.bottom) {
        setYGEdgeValue(YGNodeStyleSetPosition, YGNodeStyleSetPositionPercent,
            YGNodeStyleSetPositionAuto, _node, YGEdgeBottom, *value);
    }

    if (const auto& value = style.left) {
        setYGEdgeValue(YGNodeStyleSetPosition, YGNodeStyleSetPositionPercent,
            YGNodeStyleSetPositionAuto, _node, YGEdgeLeft, *value);
    }

    if (const auto& value = style.right) {
        setYGEdgeValue(YGNodeStyleSetPosition, YGNodeStyleSetPositionPercent,
            YGNodeStyleSetPositionAuto, _node, YGEdgeRight, *value);
    }

    if (const auto& value = style.start) {
        setYGEdgeValue(YGNodeStyleSetPosition, YGNodeStyleSetPositionPercent,
            YGNodeStyleSetPositionAuto, _node, YGEdgeStart, *value);
    }

    if (const auto& value = style.end) {
        setYGEdgeValue(YGNodeStyleSetPosition, YGNodeStyleSetPositionPercent,
            YGNodeStyleSetPositionAuto, _node, YGEdgeEnd, *value);
    }

    // Margin properties
    if (const auto& value = style.margin) {
        setYGEdgeValue(YGNodeStyleSetMargin, YGNodeStyleSetMarginPercent,
            YGNodeStyleSetMarginAuto, _node, YGEdgeAll, *value);
    }

    if (const auto& value = style.marginTop) {
        setYGEdgeValue(YGNodeStyleSetMargin, YGNodeStyleSetMarginPercent,
            YGNodeStyleSetMarginAuto, _node, YGEdgeTop, *value);
    }

    if (const auto& value = style.marginBottom) {
        setYGEdgeValue(YGNodeStyleSetMargin, YGNodeStyleSetMarginPercent,
            YGNodeStyleSetMarginAuto, _node, YGEdgeBottom, *value);
    }

    if (const auto& value = style.marginLeft) {
        setYGEdgeValue(YGNodeStyleSetMargin, YGNodeStyleSetMarginPercent,
            YGNodeStyleSetMarginAuto, _node, YGEdgeLeft, *value);
    }

    if (const auto& value = style.marginRight) {
        setYGEdgeValue(YGNodeStyleSetMargin, YGNodeStyleSetMarginPercent,
            YGNodeStyleSetMarginAuto, _node, YGEdgeRight, *value);
    }

    if (const auto& value = style.marginStart) {
        setYGEdgeValue(YGNodeStyleSetMargin, YGNodeStyleSetMarginPercent,
            YGNodeStyleSetMarginAuto, _node, YGEdgeStart, *value);
    }

    if (const auto& value = style.marginEnd) {
        setYGEdgeValue(YGNodeStyleSetMargin, YGNodeStyleSetMarginPercent,
            YGNodeStyleSetMarginAuto, _node, YGEdgeEnd, *value);
    }

    if (const auto& value = style.marginHorizontal) {
        setYGEdgeValue(YGNodeStyleSetMargin, YGNodeStyleSetMarginPercent,
            YGNodeStyleSetMarginAuto, _node, YGEdgeHorizontal, *value);
    }

    if (const auto& value = style.marginVertical) {
        setYGEdgeValue(YGNodeStyleSetMargin, YGNodeStyleSetMarginPercent,
            YGNodeStyleSetMarginAuto, _node, YGEdgeVertical, *value);
    }

    // Padding properties
    if (const auto& value = style.padding) {
        setYGEdgeValue(YGNodeStyleSetPadding, YGNodeStyleSetPaddingPercent,
            nullptr, _node, YGEdgeAll, *value);
    }

    if (const auto& value = style.paddingTop) {
        setYGEdgeValue(YGNodeStyleSetPadding, YGNodeStyleSetPaddingPercent,
            nullptr, _node, YGEdgeTop, *value);
    }

    if (const auto& value = style.paddingBottom) {
        setYGEdgeValue(YGNodeStyleSetPadding, YGNodeStyleSetPaddingPercent,
            nullptr, _node, YGEdgeBottom, *value);
    }

    if (const auto& value = style.paddingLeft) {
        setYGEdgeValue(YGNodeStyleSetPadding, YGNodeStyleSetPaddingPercent,
            nullptr, _node, YGEdgeLeft, *value);
    }

    if (const auto& value = style.paddingRight) {
        setYGEdgeValue(YGNodeStyleSetPadding, YGNodeStyleSetPaddingPercent,
            nullptr, _node, YGEdgeRight, *value);
    }

    if (const auto& value = style.paddingStart) {
        setYGEdgeValue(YGNodeStyleSetPadding, YGNodeStyleSetPaddingPercent,
            nullptr, _node, YGEdgeStart, *value);
    }

    if (const auto& value = style.paddingEnd) {
        setYGEdgeValue(YGNodeStyleSetPadding, YGNodeStyleSetPaddingPercent,
            nullptr, _node, YGEdgeEnd, *value);
    }

    if (const auto& value = style.paddingHorizontal) {
        setYGEdgeValue(YGNodeStyleSetPadding, YGNodeStyleSetPaddingPercent,
            nullptr, _node, YGEdgeHorizontal, *value);
    }

    if (const auto& value = style.paddingVertical) {
        setYGEdgeValue(YGNodeStyleSetPadding, YGNodeStyleSetPaddingPercent,
            nullptr, _node, YGEdgeVertical, *value);
    }

    // Border properties
    if (const auto& value = style.borderWidth) {
        auto val = static_cast<float>(*value);
        YGNodeStyleSetBorder(_node, YGEdgeAll, val);
        _paint.setStrokeWidth(val);
    }

    if (const auto& value = style.strokeCap) {
        _paint.setStrokeCap(static_cast<SkPaint::Cap>(*value));
    }

    if (const auto& value = style.strokeJoin) {
        _paint.setStrokeJoin(static_cast<SkPaint::Join>(*value));
    }

    if (const auto& value = style.strokeMiter) {
        _paint.setStrokeMiter(*value);
    }

    if (const auto& value = style.borderTopWidth) {
        YGNodeStyleSetBorder(_node, YGEdgeTop, static_cast<float>(*value));
    }

    if (const auto& value = style.borderBottomWidth) {
        YGNodeStyleSetBorder(_node, YGEdgeBottom, static_cast<float>(*value));
    }

    if (const auto& value = style.borderLeftWidth) {
        YGNodeStyleSetBorder(_node, YGEdgeLeft, static_cast<float>(*value));
    }

    if (const auto& value = style.borderRightWidth) {
        YGNodeStyleSetBorder(_node, YGEdgeRight, static_cast<float>(*value));
    }

    if (const auto& value = style.borderStartWidth) {
        YGNodeStyleSetBorder(_node, YGEdgeStart, static_cast<float>(*value));
    }

    if (const auto& value = style.borderEndWidth) {
        YGNodeStyleSetBorder(_node, YGEdgeEnd, static_cast<float>(*value));
    }

    if (const auto& value = style.borderHorizontalWidth) {
        float width = static_cast<float>(*value);
        YGNodeStyleSetBorder(_node, YGEdgeHorizontal, width);
    }

    if (const auto& value = style.borderVerticalWidth) {
        float width = static_cast<float>(*value);
        YGNodeStyleSetBorder(_node, YGEdgeVertical, width);
    }

    // Gap properties
    if (const auto& value = style.gap) {
        YGNodeStyleSetGap(_node, YGGutterAll, static_cast<float>(*value));
    }

    if (const auto& value = style.rowGap) {
        YGNodeStyleSetGap(_node, YGGutterRow, static_cast<float>(*value));
    }

    if (const auto& value = style.columnGap) {
        YGNodeStyleSetGap(_node, YGGutterColumn, static_cast<float>(*value));
    }

    // Inset properties: TODO object
    if (const auto& value = style.inset) {
        // Apply to all edges
        setYGEdgeValue(YGNodeStyleSetPosition, YGNodeStyleSetPositionPercent,
            YGNodeStyleSetPositionAuto, _node, YGEdgeAll, *value);
    }

    if (const auto& value = style.insetHorizontal) {
        setYGEdgeValue(YGNodeStyleSetPosition, YGNodeStyleSetPositionPercent,
            YGNodeStyleSetPositionAuto, _node, YGEdgeHorizontal, *value);
    }

    if (const auto& value = style.insetVertical) {
        setYGEdgeValue(YGNodeStyleSetPosition, YGNodeStyleSetPositionPercent,
            YGNodeStyleSetPositionAuto, _node, YGEdgeVertical, *value);
    }

    if (const auto& value = style.layer) {
        _layerPaint = *value;
    }

    if (const auto& value = style.antiaAlias) {
        _paint.setAntiAlias(*value);
    }

    if (const auto& value = style.dither) {
        _paint.setDither(*value);
    }

    if (const auto& value = style.backgroundColor) {

        if (std::holds_alternative<std::string>(*value)) {
            const auto& str = std::get<std::string>(*value);
            if (auto parsed = parseCssColor(str)) {
                _paint.setColor(*parsed);
            }
        } else {
            // backgroundColor is a SkPaint
            const auto& p = std::get<SkPaint>(*value);
            _paint = p;
        }
    }

    if (const auto& value = style.opacity) {
        _paint.setAlphaf(static_cast<float>(*value));
    }

    if (const auto& value = style.blendMode) {
        _paint.setBlendMode(static_cast<SkBlendMode>(*value));
    }

    const bool clipsOverflow =
        style.overflow.has_value() &&
        (style.overflow.value() == Overflow::HIDDEN || style.overflow.value() == Overflow::SCROLL);

    auto shouldClipToBounds = style.borderRadius.has_value() || style.borderTopLeftRadius.has_value() || style.borderTopRightRadius.has_value() || style.borderBottomLeftRadius.has_value() || style.borderBottomRightRadius.has_value();

    if (shouldClipToBounds) {
        detail::CornerRadii radii;
        radii.fill(SkVector::Make(0.0f, 0.0f));

        if (const auto& value = style.borderRadius) {
            auto radius = static_cast<float>(*value);
            radii[SkRRect::kUpperLeft_Corner] = SkVector::Make(radius, radius);
            radii[SkRRect::kUpperRight_Corner] = SkVector::Make(radius, radius);
            radii[SkRRect::kLowerRight_Corner] = SkVector::Make(radius, radius);
            radii[SkRRect::kLowerLeft_Corner] = SkVector::Make(radius, radius);

            shouldClipToBounds = true;
        }

        auto setCornerRadius = [&](const auto& val, int corner) {
            if (val) {
                if (std::holds_alternative<SkPoint>(*val)) {
                    SkPoint p = std::get<SkPoint>(*val);
                    radii[corner] = SkVector::Make(p.x, p.y);
                } else {
                    auto radius = static_cast<float>(std::get<double>(*val));
                    radii[corner] = SkVector::Make(radius, radius);
                }
                shouldClipToBounds = true;
            }
        };

        setCornerRadius(style.borderTopLeftRadius, SkRRect::kUpperLeft_Corner);
        setCornerRadius(style.borderTopRightRadius, SkRRect::kUpperRight_Corner);
        setCornerRadius(style.borderBottomRightRadius, SkRRect::kLowerRight_Corner);
        setCornerRadius(style.borderBottomLeftRadius, SkRRect::kLowerLeft_Corner);

        _clipsToBounds = true;
        _clipToBoundsRadii = radii;
    } else {
        _clipsToBounds = clipsOverflow;
        _clipToBoundsRadii.reset();
    }

    if (const auto& value = style.clip) {
        if (std::holds_alternative<SkPath>(*value)) {
            _clipPath = std::get<SkPath>(*value);
            _clipRRect.reset();
            _clipRect.reset();
        } else if (std::holds_alternative<SkRRect>(*value)) {
            _clipRRect = std::get<SkRRect>(*value);
            _clipPath.reset();
            _clipRect.reset();
        } else if (std::holds_alternative<SkRect>(*value)) {
            SkRect r = std::get<SkRect>(*value);
            _clipRect = r;
            _clipPath.reset();
            _clipRRect.reset();
        }
    } else {
        _clipPath.reset();
        _clipRRect.reset();
        _clipRect.reset();
    }

    if (const auto& value = style.matrix) {
        _matrix = makeMatrixPointer(*value);
    } else if (!style.transform.has_value()) {
        _matrix.reset();
    }

    if (const auto& value = style.transform) {
        SkM44 matrix;
        matrix.setIdentity();
        bool hasTransform = false;

        for (const auto& transform : *value) {
            std::visit(
                [&](const auto& op) {
                    using T = std::decay_t<decltype(op)>;

                    if constexpr (std::is_same_v<T, TransformRotateX>) {
                        SkM44 rotate;
                        rotate.setRotateUnit({ 1.0f, 0.0f, 0.0f }, static_cast<float>(op.rotateX));
                        matrix.preConcat(rotate);
                        hasTransform = true;
                    } else if constexpr (std::is_same_v<T, TransformRotateY>) {
                        SkM44 rotate;
                        rotate.setRotateUnit({ 0.0f, 1.0f, 0.0f }, static_cast<float>(op.rotateY));
                        matrix.preConcat(rotate);
                        hasTransform = true;
                    } else if constexpr (std::is_same_v<T, TransformRotateZ>) {
                        SkM44 rotate;
                        rotate.setRotateUnit({ 0.0f, 0.0f, 1.0f }, static_cast<float>(op.rotateZ));
                        matrix.preConcat(rotate);
                        hasTransform = true;
                    } else if constexpr (std::is_same_v<T, TransformScale>) {
                        const float s = static_cast<float>(op.scale);
                        matrix.preScale(s, s, 1.0f);
                        hasTransform = true;
                    } else if constexpr (std::is_same_v<T, TransformScaleX>) {
                        matrix.preScale(static_cast<float>(op.scaleX), 1.0f, 1.0f);
                        hasTransform = true;
                    } else if constexpr (std::is_same_v<T, TransformScaleY>) {
                        matrix.preScale(1.0f, static_cast<float>(op.scaleY), 1.0f);
                        hasTransform = true;
                    } else if constexpr (std::is_same_v<T, TransformTranslateX>) {
                        matrix.preTranslate(static_cast<float>(op.translateX), 0.0f, 0.0f);
                        hasTransform = true;
                    } else if constexpr (std::is_same_v<T, TransformTranslateY>) {
                        matrix.preTranslate(0.0f, static_cast<float>(op.translateY), 0.0f);
                        hasTransform = true;
                    } else if constexpr (std::is_same_v<T, TransformSkewX>) {
                        const float tangent = static_cast<float>(std::tan(op.skewX));
                        SkM44 skew(1.0f, 0.0f, 0.0f, 0.0f,
                            tangent, 1.0f, 0.0f, 0.0f,
                            0.0f, 0.0f, 1.0f, 0.0f,
                            0.0f, 0.0f, 0.0f, 1.0f);
                        matrix.preConcat(skew);
                        hasTransform = true;
                    } else if constexpr (std::is_same_v<T, TransformSkewY>) {
                        const float tangent = static_cast<float>(std::tan(op.skewY));
                        SkM44 skew(1.0f, tangent, 0.0f, 0.0f,
                            0.0f, 1.0f, 0.0f, 0.0f,
                            0.0f, 0.0f, 1.0f, 0.0f,
                            0.0f, 0.0f, 0.0f, 1.0f);
                        matrix.preConcat(skew);
                        hasTransform = true;
                    }
                },
                transform);
        }

        if (hasTransform) {
            _matrix = std::make_shared<SkMatrix>(matrix.asM33());
        } else {
            _matrix.reset();
        }
    }
}

jsi::Value YogaNode::setStyleRaw(jsi::Runtime& runtime, const jsi::Value& thisArg, const jsi::Value* args, size_t count)
{
    (void)thisArg;

    if (count < 1) {
        throw jsi::JSError(runtime, "YogaNode.setStyle(style) expects a style object.");
    }

    try {
        const auto style = JSIConverter<NodeStyle>::fromJSI(runtime, args[0]);
        setStyle(style);
        return jsi::Value::undefined();
    } catch (const jsi::JSError&) {
        throw;
    } catch (const std::exception& error) {
        throw jsi::JSError(
            runtime,
            "YogaNode.setStyle(style) failed. style=" + describeJSIValue(runtime, args[0]) +
                " cause=" + error.what());
    } catch (...) {
        throw jsi::JSError(
            runtime,
            "YogaNode.setStyle(style) failed. style=" + describeJSIValue(runtime, args[0]) +
                " cause=Unknown native error");
    }
}

void YogaNode::insertChild(const std::shared_ptr<HybridYogaNodeSpec>& child, const std::optional<std::variant<double, std::shared_ptr<HybridYogaNodeSpec>>>& index)
{
    if (!child) {
        return; // No child to insert
    }

    auto yogaNode = std::dynamic_pointer_cast<YogaNode>(child);

    if (!yogaNode) {
        throw std::runtime_error("Child is not a YogaNode");
    }

    size_t insertIndex = 0;

    if (index.has_value()) {
        if (std::holds_alternative<double>(index.value())) {
            double idx = std::get<double>(index.value());
            if (idx < 0 || idx >= YGNodeGetChildCount(_node)) {
                throw std::out_of_range("Index out of range for YogaNode children");
            }
            insertIndex = static_cast<uint32_t>(idx);
        } else if (std::holds_alternative<std::shared_ptr<margelo::nitro::RNSkiaYoga::HybridYogaNodeSpec>>(index.value())) {
            auto indexNode = std::get<std::shared_ptr<margelo::nitro::RNSkiaYoga::HybridYogaNodeSpec>>(index.value());
            auto indexYogaNode = std::dynamic_pointer_cast<YogaNode>(indexNode);
            if (!indexYogaNode) {
                throw std::runtime_error("Index is not a YogaNode");
            }
            // Insert before the given index node
            uint32_t childCount = YGNodeGetChildCount(_node);
            bool found = false;
            for (uint32_t i = 0; i < childCount; ++i) {
                if (YGNodeGetChild(_node, i) == indexYogaNode->_node) {
                    insertIndex = i;
                    found = true;
                    break;
                }
            }
            if (!found) {
                throw std::runtime_error("Index node is not a child of this YogaNode");
            }
        } else {
            throw std::runtime_error("Invalid index type for YogaNode insertion");
        }
    } else {
        insertIndex = YGNodeGetChildCount(_node);
    }

    YGNodeInsertChild(_node, yogaNode->_node, insertIndex);
    yogaNode->_parent = this;

    _children.insert(_children.begin() + static_cast<std::ptrdiff_t>(insertIndex), yogaNode);
    adjustInteractiveDescendantCount(yogaNode->_interactiveDescendantCount);
    invalidateLayout();
}

// void removeChild(const std::shared_ptr<HybridYogaNodeSpec>& child) override;
void YogaNode::removeChild(const std::shared_ptr<HybridYogaNodeSpec>& c)
{
    auto child = std::dynamic_pointer_cast<YogaNode>(c);

    YGNodeRemoveChild(_node, child->_node);
    child->_parent = nullptr;
    _children.erase(std::remove(_children.begin(), _children.end(), child), _children.end());
    adjustInteractiveDescendantCount(-child->_interactiveDescendantCount);
    invalidateLayout();
}

void YogaNode::removeAllChildren()
{
    for (auto& child : _children) {
        adjustInteractiveDescendantCount(-child->_interactiveDescendantCount);
        child->_parent = nullptr;
    }
    YGNodeRemoveAllChildren(_node);
    _children.clear();
    invalidateLayout();
}

void YogaNode::setCommand(NodeCommand command)
{
    invalidateRasterCache();

    auto* runtime = RNJsi::BaseRuntimeAwareCache::getMainJsRuntime();
    if (runtime == nullptr) {
        throw std::runtime_error("Main JS runtime is not available.");
    }

    RNSkia::Variables variables; // TODO: save reanimated shared values
    switch (command.type) {
    case NodeCommandKind::RECT:
        if (_commandKind == YogaNodeCommandKind::NONE) {
            _command = std::make_unique<RectCmd>(this, *runtime, variables);
            _commandKind = YogaNodeCommandKind::RECT;
        } else if (_commandKind != YogaNodeCommandKind::RECT) {
            throw std::runtime_error("YogaNode command type cannot change after initialization.");
        }
        break;
    case NodeCommandKind::RRECT:
        if (_commandKind == YogaNodeCommandKind::NONE) {
            _command = std::make_unique<RRectCmd>(this, *runtime, variables);
            _commandKind = YogaNodeCommandKind::RRECT;
        } else if (_commandKind != YogaNodeCommandKind::RRECT) {
            throw std::runtime_error("YogaNode command type cannot change after initialization.");
        }
        static_cast<RRectCmd*>(_command.get())->updateProps(std::get<RoundedRectCommandData>(command.data));
        break;
    case NodeCommandKind::TEXT:
        if (_commandKind == YogaNodeCommandKind::NONE) {
            _command = std::make_unique<TextCmd>(this, *runtime, variables);
            _commandKind = YogaNodeCommandKind::TEXT;
        } else if (_commandKind != YogaNodeCommandKind::TEXT) {
            throw std::runtime_error("YogaNode command type cannot change after initialization.");
        }
        static_cast<TextCmd*>(_command.get())->updateProps(std::get<TextCommandData>(command.data));
        break;
    case NodeCommandKind::GROUP:
        if (_commandKind == YogaNodeCommandKind::NONE) {
            _command = std::make_unique<GroupCmd>(this);
            _commandKind = YogaNodeCommandKind::GROUP;
        } else if (_commandKind != YogaNodeCommandKind::GROUP) {
            throw std::runtime_error("YogaNode command type cannot change after initialization.");
        }
        static_cast<GroupCmd*>(_command.get())->updateProps(std::get<GroupCommandData>(command.data));
        break;
    case NodeCommandKind::BLUR_MASK_FILTER:
        if (_commandKind == YogaNodeCommandKind::NONE) {
            _command = std::make_unique<BlurMaskFilterCmd>(this);
            _commandKind = YogaNodeCommandKind::BLUR_MASK_FILTER;
        } else if (_commandKind != YogaNodeCommandKind::BLUR_MASK_FILTER) {
            throw std::runtime_error("YogaNode command type cannot change after initialization.");
        }
        static_cast<BlurMaskFilterCmd*>(_command.get())->updateProps(std::get<BlurMaskFilterCommandData>(command.data));
        break;
    case NodeCommandKind::IMAGE:
        if (_commandKind == YogaNodeCommandKind::NONE) {
            _command = std::make_unique<ImageCmd>(this, *runtime, variables);
            _commandKind = YogaNodeCommandKind::IMAGE;
        } else if (_commandKind != YogaNodeCommandKind::IMAGE) {
            throw std::runtime_error("YogaNode command type cannot change after initialization.");
        }
        static_cast<ImageCmd*>(_command.get())->updateProps(std::get<ImageCommandData>(command.data));
        break;
    case NodeCommandKind::PATH:
        if (_commandKind == YogaNodeCommandKind::NONE) {
            _command = std::make_unique<PathCmd>(this, *runtime, variables);
            _commandKind = YogaNodeCommandKind::PATH;
        } else if (_commandKind != YogaNodeCommandKind::PATH) {
            throw std::runtime_error("YogaNode command type cannot change after initialization.");
        }
        static_cast<PathCmd*>(_command.get())->updateProps(std::get<PathCommandData>(command.data));
        break;
    case NodeCommandKind::PARAGRAPH:
        if (_commandKind == YogaNodeCommandKind::NONE) {
            _command = std::make_unique<ParagraphCmd>(this, *runtime, variables);
            _commandKind = YogaNodeCommandKind::PARAGRAPH;
            YGNodeSetMeasureFunc(_node, margelo::nitro::RNSkiaYoga::ParagraphCmd::measureFunc);
        } else if (_commandKind != YogaNodeCommandKind::PARAGRAPH) {
            throw std::runtime_error("YogaNode command type cannot change after initialization.");
        }
        static_cast<ParagraphCmd*>(_command.get())->updateProps(std::get<ParagraphCommandData>(command.data));
        break;
    case NodeCommandKind::CIRCLE:
        if (_commandKind == YogaNodeCommandKind::NONE) {
            _command = std::make_unique<CircleCmd>(this, *runtime, variables);
            _commandKind = YogaNodeCommandKind::CIRCLE;
        } else if (_commandKind != YogaNodeCommandKind::CIRCLE) {
            throw std::runtime_error("YogaNode command type cannot change after initialization.");
        }
        static_cast<CircleCmd*>(_command.get())->updateProps(std::get<CircleCommandData>(command.data));
        break;
    case NodeCommandKind::LINE:
        if (_commandKind == YogaNodeCommandKind::NONE) {
            _command = std::make_unique<LineCmd>(this, *runtime, variables);
            _commandKind = YogaNodeCommandKind::LINE;
        } else if (_commandKind != YogaNodeCommandKind::LINE) {
            throw std::runtime_error("YogaNode command type cannot change after initialization.");
        }
        static_cast<LineCmd*>(_command.get())->updateProps(std::get<LineCommandData>(command.data));
        break;
    case NodeCommandKind::OVAL:
        if (_commandKind == YogaNodeCommandKind::NONE) {
            _command = std::make_unique<OvalCmd>(this, *runtime, variables);
            _commandKind = YogaNodeCommandKind::OVAL;
        } else if (_commandKind != YogaNodeCommandKind::OVAL) {
            throw std::runtime_error("YogaNode command type cannot change after initialization.");
        }
        break;
    case NodeCommandKind::POINTS:
        if (_commandKind == YogaNodeCommandKind::NONE) {
            _command = std::make_unique<PointsCmd>(this, *runtime, variables);
            _commandKind = YogaNodeCommandKind::POINTS;
        } else if (_commandKind != YogaNodeCommandKind::POINTS) {
            throw std::runtime_error("YogaNode command type cannot change after initialization.");
        }
        static_cast<PointsCmd*>(_command.get())->updateProps(std::get<PointsCommandData>(command.data));
        break;
    }
}

jsi::Value YogaNode::draw(jsi::Runtime& runtime, const jsi::Value& thisArg, const jsi::Value* args, size_t count)
{
    (void)thisArg;
    (void)args;
    (void)count;
    jsi::Object props = jsi::Object(runtime);
    SkPictureRecorder pictureRecorder;
    SkISize size = SkISize::Make(2'000'000, 2'000'000);
    SkRect rect = SkRect::Make(size);
    auto canvas = pictureRecorder.beginRecording(rect, nullptr);
    RNSkia::DrawingCtx ctx(canvas);

    if (!_command) {
        return jsi::Value::undefined();
    }

    drawInternal(ctx);

    auto picture = pictureRecorder.finishRecordingAsPicture();
    return jsi::Object::createFromHostObject(runtime, std::make_shared<RNSkia::JsiSkPicture>(margelo::nitro::RNSkiaYoga::SkiaYoga::getPlatformContext(), picture));
}

void YogaNode::drawInternal(RNSkia::DrawingCtx& ctx)
{
    if (!_command) {
        return;
    }

    auto op = _style.invertClip.has_value() && _style.invertClip.value() ? SkClipOp::kDifference : SkClipOp::kIntersect;

    if (_layerPaint.has_value()) {
        const SkPaint* paint = &(_layerPaint.value());
        ctx.canvas->saveLayer(nullptr, paint);
    } else {
        ctx.canvas->save();
    }

    if (!_hasLayoutBeenComputed) {
        computeLayout(std::nullopt, std::nullopt);
    }

    ctx.canvas->translate(_layout.left, _layout.top);

    if (_matrix) {
        ctx.canvas->concat(*_matrix);
    }

    if (_clipsToBounds) {
        if (_clipToBoundsRadii.has_value()) {
            const auto clipBounds = detail::makeRoundedRect(_layout, *_clipToBoundsRadii);
            SkPath clipPath;
            clipPath.addRRect(clipBounds);
            ctx.canvas->clipPath(clipPath, SkClipOp::kIntersect, true);
        } else {
            ctx.canvas->clipRect(
                SkRect::MakeXYWH(0, 0, _layout.width, _layout.height),
                SkClipOp::kIntersect,
                true);
        }
    }

    if (_clipPath.has_value()) {
        ctx.canvas->clipPath(*_clipPath, op, true);
    } else if (_clipRect.has_value()) {
        ctx.canvas->clipRect(*_clipRect, op, true);
    } else if (_clipRRect.has_value()) {
        ctx.canvas->clipRRect(*_clipRRect, op, true);
    }

    auto maskFilter = ctx.getPaint().refMaskFilter();
    _paint.setMaskFilter(maskFilter);

    ctx.pushPaint(_paint);

    _command->draw(&ctx);

    if (_command->rasterizesSubtree()) {
        const auto width = std::max(1, static_cast<int>(std::ceil(_layout.width)));
        const auto height = std::max(1, static_cast<int>(std::ceil(_layout.height)));
        const auto hasDynamicContent = subtreeHasDynamicRasterContent();
        const auto canReuseRasterCache =
            !hasDynamicContent &&
            !_rasterCacheDirty &&
            _rasterCache != nullptr &&
            _rasterCacheWidth == width &&
            _rasterCacheHeight == height;

        if (canReuseRasterCache) {
            ctx.canvas->drawImage(_rasterCache, 0.0f, 0.0f);
        } else {
            const auto imageInfo = SkImageInfo::MakeN32Premul(width, height);
            const auto surface = SkSurfaces::Raster(imageInfo);

            if (surface != nullptr) {
                auto* offscreenCanvas = surface->getCanvas();
                offscreenCanvas->clear(SK_ColorTRANSPARENT);

                RNSkia::DrawingCtx offscreenCtx(offscreenCanvas);
                auto maskFilter = ctx.getPaint().refMaskFilter();
                _paint.setMaskFilter(maskFilter);
                offscreenCtx.pushPaint(_paint);
                drawChildren(offscreenCtx);
                offscreenCtx.restorePaint();

                const auto image = surface->makeImageSnapshot();
                if (image != nullptr) {
                    if (hasDynamicContent) {
                        _rasterCache.reset();
                        _rasterCacheDirty = true;
                    } else {
                        _rasterCache = image;
                        _rasterCacheDirty = false;
                    }

                    _rasterCacheWidth = width;
                    _rasterCacheHeight = height;
                    ctx.canvas->drawImage(image, 0.0f, 0.0f);
                }
            }
        }
    } else {
        drawChildren(ctx);
    }

    ctx.restorePaint();

    ctx.canvas->restore();
}

void YogaNode::drawChildren(RNSkia::DrawingCtx& ctx)
{
    for (const auto& child : _children) {
        if (!child->_hasLayoutBeenComputed) {
            child->computeLayout(_layout.width, _layout.height);
        }

        if (child->_command) {
            child->drawInternal(ctx);
        }
    }
}

bool YogaNode::subtreeHasDynamicRasterContent() const
{
    if (_command && _command->isDynamic()) {
        return true;
    }

    for (const auto& child : _children) {
        if (child->subtreeHasDynamicRasterContent()) {
            return true;
        }
    }

    return false;
}

jsi::Value YogaNode::getChildren(jsi::Runtime& runtime, const jsi::Value& thisArg, const jsi::Value* args, size_t count)
{
    jsi::Array arr = jsi::Array(runtime, _children.size());
    for (size_t i = 0; i < _children.size(); ++i) {
        auto obj = JSIConverter<std::shared_ptr<margelo::nitro::RNSkiaYoga::YogaNode>>::toJSI(runtime, _children[i]);
        arr.setValueAtIndex(runtime, i, obj);
    }
    return arr;
}

void YogaNode::computeLayout(std::optional<double> width, std::optional<double> height)
{
    float w = width.has_value() ? static_cast<float>(width.value()) : YGUndefined;
    float h = height.has_value() ? static_cast<float>(height.value()) : YGUndefined;

    YGNodeCalculateLayout(_node, w, h, YGDirectionInherit);
    recursiveSetLayout();
}

void YogaNode::recursiveSetLayout()
{
    _layout.left = YGNodeLayoutGetLeft(_node);
    _layout.right = YGNodeLayoutGetRight(_node);
    _layout.width = YGNodeLayoutGetWidth(_node);
    _layout.height = YGNodeLayoutGetHeight(_node);
    _layout.top = YGNodeLayoutGetTop(_node);
    _layout.bottom = YGNodeLayoutGetBottom(_node);
    if (_command) {
        _command->setLayout(_layout);
    }
    _hasLayoutBeenComputed = true;

    for (const auto& child : _children) {
        child->recursiveSetLayout();
    }
}

void YogaNode::invalidateLayout()
{
    _hasLayoutBeenComputed = false;
    _rasterCacheDirty = true;
    _rasterCache.reset();
    if (_parent != nullptr) {
        _parent->invalidateLayout();
    }
}

void YogaNode::invalidateRasterCache()
{
    _rasterCacheDirty = true;
    _rasterCache.reset();

    if (_parent != nullptr) {
        _parent->invalidateRasterCache();
    }
}

void YogaNode::adjustInteractiveDescendantCount(int delta)
{
    if (delta == 0) {
        return;
    }

    _interactiveDescendantCount += delta;

    if (_parent != nullptr) {
        _parent->adjustInteractiveDescendantCount(delta);
    }
}

void YogaNode::updateSelfInteractionState(bool isInteractive)
{
    if (_selfInteractive == isInteractive) {
        return;
    }

    _selfInteractive = isInteractive;
    adjustInteractiveDescendantCount(isInteractive ? 1 : -1);
}

bool YogaNode::pointPassesClipping(const ::SkPoint& point) const
{
    if (_clipsToBounds) {
        const auto bounds = SkRect::MakeXYWH(0.0f, 0.0f, _layout.width, _layout.height);
        if (_clipToBoundsRadii.has_value()) {
            if (!detail::pointInRoundedRect(point, bounds, *_clipToBoundsRadii)) {
                return false;
            }
        } else if (!bounds.contains(point.fX, point.fY)) {
            return false;
        }
    }

    bool hasExplicitClip = false;
    bool explicitClipContains = true;
    if (_clipPath.has_value()) {
        hasExplicitClip = true;
        explicitClipContains = _clipPath->contains(point.fX, point.fY);
    } else if (_clipRect.has_value()) {
        hasExplicitClip = true;
        explicitClipContains = _clipRect->contains(point.fX, point.fY);
    } else if (_clipRRect.has_value()) {
        hasExplicitClip = true;
        SkPath clipPath;
        clipPath.addRRect(*_clipRRect);
        explicitClipContains = clipPath.contains(point.fX, point.fY);
    }

    if (hasExplicitClip && _style.invertClip.value_or(false)) {
        explicitClipContains = !explicitClipContains;
    }

    return explicitClipContains;
}

bool YogaNode::containsSelfAtPoint(const ::SkPoint& point) const
{
    const auto bounds = SkRect::MakeLTRB(
        -_hitSlop.left,
        -_hitSlop.top,
        static_cast<float>(_layout.width) + _hitSlop.right,
        static_cast<float>(_layout.height) + _hitSlop.bottom);

    if (!bounds.contains(point.fX, point.fY)) {
        return false;
    }

    if (!_preciseHit || !_command || !_command->supportsPreciseHitTesting()) {
        return true;
    }

    return _command->containsLocalPoint(point);
}

double YogaNode::hitTestInternal(const ::SkPoint& parentPoint) const
{
    if (_interactiveDescendantCount == 0 || _pointerEvents == PointerEventsMode::NONE) {
        return 0.0;
    }

    auto localPoint = parentPoint;
    localPoint.offset(-static_cast<float>(_layout.left), -static_cast<float>(_layout.top));

    if (_matrix != nullptr) {
        SkMatrix inverse;
        if (!_matrix->invert(&inverse)) {
            return 0.0;
        }
        localPoint = inverse.mapPoint(localPoint);
    }

    if (!pointPassesClipping(localPoint)) {
        return 0.0;
    }

    if (_pointerEvents != PointerEventsMode::BOX_ONLY) {
        for (auto it = _children.rbegin(); it != _children.rend(); ++it) {
            if (const auto tag = (*it)->hitTestInternal(localPoint); tag > 0.0) {
                return tag;
            }
        }
    }

    if (_pointerEvents != PointerEventsMode::BOX_NONE && _selfInteractive && containsSelfAtPoint(localPoint)) {
        return _eventTag;
    }

    return 0.0;
}

double YogaNode::hitTestTagAt(float x, float y)
{
    if (!_hasLayoutBeenComputed) {
        computeLayout(std::nullopt, std::nullopt);
    }

    return hitTestInternal(::SkPoint::Make(x, y));
}

jsi::Value YogaNode::hitTest(jsi::Runtime& runtime, const jsi::Value& thisArg, const jsi::Value* args, size_t count)
{
    (void)thisArg;

    if (count < 2 || !args[0].isNumber() || !args[1].isNumber()) {
        throw jsi::JSError(runtime, "YogaNode.hitTest(x, y) expects numeric x and y arguments.");
    }

    const auto x = static_cast<float>(args[0].asNumber());
    const auto y = static_cast<float>(args[1].asNumber());
    return jsi::Value(hitTestTagAt(x, y));
}

jsi::Value YogaNode::setInteractionConfig(jsi::Runtime& runtime, const jsi::Value& thisArg, const jsi::Value* args, size_t count)
{
    (void)thisArg;

    if (count < 1 || !args[0].isObject()) {
        throw jsi::JSError(runtime, "YogaNode.setInteractionConfig(config) expects a config object.");
    }

    const auto config = args[0].asObject(runtime);

    auto pointerEvents = PointerEventsMode::AUTO;
    if (config.hasProperty(runtime, "pointerEvents")) {
        const auto value = config.getProperty(runtime, "pointerEvents");
        if (value.isString()) {
            pointerEvents = parsePointerEventsMode(value.asString(runtime).utf8(runtime));
        }
    }

    HitSlopInsets hitSlop;
    if (config.hasProperty(runtime, "hitSlop")) {
        const auto hitSlopValue = config.getProperty(runtime, "hitSlop");
        if (hitSlopValue.isNumber()) {
            const auto inset = static_cast<float>(hitSlopValue.asNumber());
            hitSlop.top = inset;
            hitSlop.right = inset;
            hitSlop.bottom = inset;
            hitSlop.left = inset;
        } else if (hitSlopValue.isObject()) {
            const auto hitSlopObject = hitSlopValue.asObject(runtime);
            hitSlop.left = getNumericProperty(runtime, hitSlopObject, "left", 0.0f);
            hitSlop.right = getNumericProperty(runtime, hitSlopObject, "right", 0.0f);
            hitSlop.top = getNumericProperty(runtime, hitSlopObject, "top", 0.0f);
            hitSlop.bottom = getNumericProperty(runtime, hitSlopObject, "bottom", 0.0f);

            const auto horizontal = getNumericProperty(runtime, hitSlopObject, "horizontal", 0.0f);
            const auto vertical = getNumericProperty(runtime, hitSlopObject, "vertical", 0.0f);
            hitSlop.left += horizontal;
            hitSlop.right += horizontal;
            hitSlop.top += vertical;
            hitSlop.bottom += vertical;
        }
    }

    _pointerEvents = pointerEvents;
    _hitSlop = hitSlop;
    _preciseHit =
        config.hasProperty(runtime, "preciseHit") &&
        config.getProperty(runtime, "preciseHit").isBool() &&
        config.getProperty(runtime, "preciseHit").getBool();

    double nextEventTag = 0.0;
    if (config.hasProperty(runtime, "eventTag")) {
        const auto value = config.getProperty(runtime, "eventTag");
        if (value.isNumber()) {
            nextEventTag = value.asNumber();
        }
    }

    _eventTag = nextEventTag;
    updateSelfInteractionState(_eventTag > 0.0);
    return jsi::Value::undefined();
}

void BlurMaskFilterCmd::updateProps(const BlurMaskFilterCommandData& props)
{
    _blur = props.blur;
    if (props.blurStyle.has_value()) {
        _props.style = props.blurStyle.value();
    }
    if (props.respectCTM.has_value()) {
        _props.respectCTM = props.respectCTM.value();
    }
}

void TextCmd::updateProps(const TextCommandData& props)
{
    this->props.text = props.text.value_or("");

    if (props.font.has_value()) {
        this->props.font = props.font.value();
    }

    const auto textStyle = props.textStyle.value_or(skia::textlayout::TextStyle());
    auto font = this->props.font;
    if (font.has_value() && textStyle.getFontSize() > 0.0f) {
        font->setSize(textStyle.getFontSize());
        this->props.font = font;
    }

    node->_paint.setColor(textStyle.getColor());
}

void ImageCmd::updateProps(const ImageCommandData& props)
{
    this->props.image = props.image;
    this->props.sampling = props.sampling;
    this->props.fit = props.fit.value_or("contain");
}

void PathCmd::updateProps(const PathCommandData& props)
{
    setBasePath(props.path);
    _trimStart = props.trimStart;
    _trimEnd = props.trimEnd;
    if (props.stroke.has_value()) {
        this->props.stroke = toNativeStrokeOpts(props.stroke.value());
    } else {
        this->props.stroke.reset();
    }
    if (props.fillType.has_value()) {
        this->props.fillType = props.fillType.value();
    } else {
        this->props.fillType.reset();
    }

    setLayout(node->_layout);
}

void LineCmd::updateProps(const LineCommandData& props)
{
    setBasePoint1(props.from);
    setBasePoint2(props.to);
    setLayout(node->_layout);
}

void PointsCmd::updateProps(const PointsCommandData& props)
{
    setBasePoints(props.points);
    if (props.pointMode.has_value()) {
        this->props.mode = props.pointMode.value();
    }
    setLayout(node->_layout);
}

void ParagraphCmd::updateProps(const ParagraphCommandData& props)
{
    if (props.paragraph.has_value() && props.paragraph.value()) {
        this->props.paragraph = props.paragraph.value();
        setLayout(node->_layout);
        return;
    }

    auto paragraphStyle = props.paragraphStyle.value_or(para::ParagraphStyle());
    auto textStyle = paragraphStyle.getTextStyle();
    if (textStyle.getFontFamilies().empty()) {
        textStyle.setFontFamilies({ SkString("Arial") });
    }
    if (textStyle.getFontSize() <= 0.0f) {
        textStyle.setFontSize(14.0f);
    }
    if (!props.paragraphStyle.has_value()) {
        textStyle.setColor(SK_ColorBLACK);
    }
    paragraphStyle.setTextStyle(textStyle);

    auto context = margelo::nitro::RNSkiaYoga::SkiaYoga::getPlatformContext();
    auto fontCollection = sk_make_sp<para::FontCollection>();
    auto fontMgr = RNSkia::JsiSkFontMgrFactory::getFontMgr(context);
    fontCollection->setDefaultFontManager(fontMgr);
    fontCollection->enableFontFallback();

    auto builder = para::ParagraphBuilder::make(paragraphStyle, fontCollection);
    if (!builder) {
        return;
    }

    builder->pushStyle(paragraphStyle.getTextStyle());
    const auto text = props.text.value_or("");
    builder->addText(text.c_str(), text.size());

    this->props.paragraph = std::make_shared<RNSkia::JsiSkParagraph>(context, builder.get());
    this->props.paragraph->getObject()->layout(ParagraphCmd::kInitialParagraphLayoutWidth);
    setLayout(node->_layout);
}

void YogaNode::setLayout(const YogaNodeLayout& layout)
{

    throw std::runtime_error("Setting layout is not supported");
}

YogaNodeLayout YogaNode::getLayout()
{
    return _layout;
}

void ParagraphCmd::ensureDefaultParagraphResources()
{
    std::lock_guard<std::mutex> lock(sParagraphBuilderMutex);
    if (sDefaultParagraphBuilder) {
        return;
    }

    if (!sDefaultParagraphStyle.has_value()) {
        sDefaultParagraphStyle.emplace();
    }

    sDefaultFontCollection = sk_make_sp<para::FontCollection>();
    auto context = margelo::nitro::RNSkiaYoga::SkiaYoga::getPlatformContext();
    auto fontMgr = RNSkia::JsiSkFontMgrFactory::getFontMgr(context);
    if (fontMgr) {
        sDefaultFontCollection->setDefaultFontManager(fontMgr);
    }
    sDefaultFontCollection->enableFontFallback();

    sDefaultParagraphBuilder = para::ParagraphBuilder::make(*sDefaultParagraphStyle, sDefaultFontCollection);
}

// Factory used by generated RNSkiaYogaOnLoad.cpp to avoid including headers there
std::shared_ptr<margelo::nitro::HybridObject> CreateYogaNode() {
    return std::make_shared<YogaNode>();
}

} // namespace margelo::nitro::RNSkiaYoga
