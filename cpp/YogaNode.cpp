#include "YogaNode.hpp"
#include "ColorParser.hpp"
#include "HybridSkiaYogaSpec.hpp"
#include "HybridYogaNodeSpec.hpp"
#include "SkColor.h"
#include "SkiaYoga.hpp"
#include <array>
#include <cmath>
#include <jsi/jsi.h>
#include <react-native-skia/cpp/api/JsiSkCanvas.h>
#include <react-native-skia/cpp/api/JsiSkHostObjects.h>
#include <react-native-skia/cpp/api/JsiSkMatrix.h>
#include <react-native-skia/cpp/api/recorder/DrawingCtx.h>
#include <react-native-skia/cpp/api/recorder/Drawings.h>
#include <react-native-skia/cpp/rnskia/RNSkManager.h>
#include <type_traits>
#include <variant>
#include <yoga/Yoga.h>

namespace margelo::nitro::RNSkiaYoga {

using namespace facebook;

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
        setYGValueOrPercent(YGNodeStyleSetWidth, YGNodeStyleSetWidthPercent,
            YGNodeStyleSetWidthAuto, _node, *value);
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

    auto shouldClip = style.borderRadius.has_value() || style.borderTopLeftRadius.has_value() || style.borderTopRightRadius.has_value() || style.borderBottomLeftRadius.has_value() || style.borderBottomRightRadius.has_value();

    if (shouldClip) {
        std::array<SkVector, 4> radii;
        radii.fill(SkVector::Make(0.0f, 0.0f));

        if (const auto& value = style.borderRadius) {
            auto radius = static_cast<float>(*value);
            radii[SkRRect::kUpperLeft_Corner] = SkVector::Make(radius, radius);
            radii[SkRRect::kUpperRight_Corner] = SkVector::Make(radius, radius);
            radii[SkRRect::kLowerRight_Corner] = SkVector::Make(radius, radius);
            radii[SkRRect::kLowerLeft_Corner] = SkVector::Make(radius, radius);

            shouldClip = true;
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
                shouldClip = true;
            }
        };

        setCornerRadius(style.borderTopLeftRadius, SkRRect::kUpperLeft_Corner);
        setCornerRadius(style.borderTopRightRadius, SkRRect::kUpperRight_Corner);
        setCornerRadius(style.borderBottomRightRadius, SkRRect::kLowerRight_Corner);
        setCornerRadius(style.borderBottomLeftRadius, SkRRect::kLowerLeft_Corner);

        _clipRRect = SkRRect();
        _clipRRectRadii = radii;
        _clipRRect->setRectRadii(SkRect::MakeXYWH(_layout.left, _layout.top, _layout.width, _layout.height), radii.data());
        _clipPath.reset();
        _clipRect.reset();
    } else if (const auto& value = style.clip) {
        if (std::holds_alternative<SkPath>(*value)) {
            _clipPath = std::get<SkPath>(*value);
            _clipRRect.reset();
            _clipRRectRadii.reset();
            _clipRect.reset();
        } else if (std::holds_alternative<SkRRect>(*value)) {
            _clipRRect = std::get<SkRRect>(*value);
            _clipPath.reset();
            _clipRRectRadii.reset();
            _clipRect.reset();
        } else if (std::holds_alternative<SkRect>(*value)) {
            SkRect r = std::get<SkRect>(*value);
            _clipRect = r;
            _clipPath.reset();
            _clipRRect.reset();
            _clipRRectRadii.reset();
        }
    } else {
        _clipPath.reset();
        _clipRRect.reset();
        _clipRect.reset();
        _clipRRectRadii.reset();
    }

    if (const auto& value = style.matrix) {
        _matrix = *value;
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

    // Store the child in our vector for easy access later
    _children.push_back(yogaNode);
}

// void removeChild(const std::shared_ptr<HybridYogaNodeSpec>& child) override;
void YogaNode::removeChild(const std::shared_ptr<HybridYogaNodeSpec>& c)
{
    auto child = std::dynamic_pointer_cast<YogaNode>(c);

    YGNodeRemoveChild(_node, child->_node);
    _children.erase(std::remove(_children.begin(), _children.end(), child), _children.end());
}

void YogaNode::removeAllChildren()
{
    YGNodeRemoveAllChildren(_node);
    _children.clear();
}

void YogaNode::setType(const NodeType type)
{
}

jsi::Value YogaNode::setType(jsi::Runtime& runtime, const jsi::Value& thisArg, const jsi::Value* args, size_t count)
{
    jsi::Object props = jsi::Object(runtime);
    RNSkia::Variables variables; // TODO: save reanimated shared values

    _type = JSIConverter<NodeType>::fromJSI(runtime, args[0]);

    switch (this->_type) {
    case NodeType::RECT: {
        auto* rectCmd = new margelo::nitro::RNSkiaYoga::RectCmd(this, runtime, props, variables);
        _command.reset(rectCmd);
        break;
    }
    case NodeType::RRECT: {
        auto* rrectCmd = new margelo::nitro::RNSkiaYoga::RRectCmd(this, runtime, props, variables);
        _command.reset(rrectCmd);
        break;
    }
    case NodeType::TEXT: {
        auto* textCmd = new margelo::nitro::RNSkiaYoga::TextCmd(this, runtime, props, variables);
        _command.reset(textCmd);
        break;
    }
    case NodeType::PATH: {
        auto* pathCmd = new margelo::nitro::RNSkiaYoga::PathCmd(this, runtime, props, variables);
        _command.reset(pathCmd);
        break;
    }
    case NodeType::LINE: {
        auto* lineCmd = new margelo::nitro::RNSkiaYoga::LineCmd(this, runtime, props, variables);
        _command.reset(lineCmd);
        break;
    }
    case NodeType::OVAL: {
        auto* ovalCmd = new margelo::nitro::RNSkiaYoga::OvalCmd(this, runtime, props, variables);
        _command.reset(ovalCmd);
        break;
    }
    case NodeType::IMAGE: {
        auto* imageCmd = new margelo::nitro::RNSkiaYoga::ImageCmd(this, runtime, props, variables);
        _command.reset(imageCmd);
        break;
    }
    case NodeType::PARAGRAPH: {
        auto* paragraphCmd = new margelo::nitro::RNSkiaYoga::ParagraphCmd(this, runtime, props, variables);
        _command.reset(paragraphCmd);

        YGNodeSetMeasureFunc(_node, margelo::nitro::RNSkiaYoga::ParagraphCmd::measureFunc);

        break;
    }
    case NodeType::GROUP:
    default:
        break;

        //   _command = std::make_unique<RNSkia::GroupCmd>(runtime, props, variables);
    }

    return jsi::Value::undefined();
}

jsi::Value YogaNode::setProps(jsi::Runtime& runtime, const jsi::Value& thisArg, const jsi::Value* args, size_t count)
{
    jsi::Object props = args[0].asObject(runtime);

    switch (this->_type) {
    case NodeType::RECT: {
        break;
    }
    case NodeType::RRECT: {
        auto rrectCmd = static_cast<margelo::nitro::RNSkiaYoga::RRectCmd*>(_command.get());
        auto radius = JSIConverter<std::optional<double>>::fromJSI(runtime, props.getProperty(runtime, "r"));
        auto r = static_cast<float>(radius.value_or(0.0));
        rrectCmd->props.r = RNSkia::Radius { .rX = r, .rY = r };
        break;
    }
    case NodeType::TEXT: {
        auto textCmd = static_cast<margelo::nitro::RNSkiaYoga::TextCmd*>(_command.get());
        textCmd->props.text = JSIConverter<std::string>::fromJSI(runtime, props.getProperty(runtime, "text"));
        textCmd->props.font = JSIConverter<SkFont>::fromJSI(runtime, props.getProperty(runtime, "font"));
        break;
    }
    case NodeType::PATH: {
        auto pathCmd = static_cast<margelo::nitro::RNSkiaYoga::PathCmd*>(_command.get());
        if (!pathCmd) {
            break;
        }

        if (props.hasProperty(runtime, "path")) {
            auto pathValue = props.getProperty(runtime, "path");
            if (pathValue.isObject()) {
                auto newPath = JSIConverter<SkPath>::fromJSI(runtime, pathValue);
                pathCmd->setBasePath(newPath);
                pathCmd->setLayout(_layout);
            }
        }

        if (props.hasProperty(runtime, "start")) {
            const auto startValue = props.getProperty(runtime, "start");
            if (startValue.isNumber()) {
                pathCmd->props.start = static_cast<float>(startValue.asNumber());
            }
        }

        if (props.hasProperty(runtime, "end")) {
            const auto endValue = props.getProperty(runtime, "end");
            if (endValue.isNumber()) {
                pathCmd->props.end = static_cast<float>(endValue.asNumber());
            }
        }

        if (props.hasProperty(runtime, "stroke")) {
            const auto strokeValue = props.getProperty(runtime, "stroke");
            if (strokeValue.isNull() || strokeValue.isUndefined()) {
                pathCmd->props.stroke.reset();
            } else if (strokeValue.isObject()) {
                pathCmd->props.stroke = RNSkia::getPropertyValue<RNSkia::StrokeOpts>(runtime, strokeValue);
            }
        }

        if (props.hasProperty(runtime, "fillType")) {
            const auto fillValue = props.getProperty(runtime, "fillType");
            if (fillValue.isNull() || fillValue.isUndefined()) {
                pathCmd->props.fillType.reset();
            } else if (fillValue.isNumber()) {
                pathCmd->props.fillType = static_cast<SkPathFillType>(static_cast<int>(fillValue.asNumber()));
            }
        }

        break;
    }
    case NodeType::LINE: {
        auto lineCmd = static_cast<margelo::nitro::RNSkiaYoga::LineCmd*>(_command.get());
        if (!lineCmd) {
            break;
        }

        bool updated = false;

        if (props.hasProperty(runtime, "p1")) {
            const auto p1Value = props.getProperty(runtime, "p1");
            if (p1Value.isObject()) {
                const auto p1 = RNSkia::getPropertyValue<::SkPoint>(runtime, p1Value);
                lineCmd->setBasePoint1(p1);
                updated = true;
            }
        }

        if (props.hasProperty(runtime, "p2")) {
            const auto p2Value = props.getProperty(runtime, "p2");
            if (p2Value.isObject()) {
                const auto p2 = RNSkia::getPropertyValue<::SkPoint>(runtime, p2Value);
                lineCmd->setBasePoint2(p2);
                updated = true;
            }
        }

        if (updated) {
            lineCmd->setLayout(_layout);
        }

        break;
    }
    case NodeType::OVAL: {
        break;
    }
    case NodeType::PARAGRAPH: {
        auto paragraphCmd = static_cast<margelo::nitro::RNSkiaYoga::ParagraphCmd*>(_command.get());
        paragraphCmd->props.paragraph = props.getProperty(runtime, "paragraph").asObject(runtime).getHostObject<RNSkia::JsiSkParagraph>(runtime);

        break;
    }
    case NodeType::IMAGE: {
        auto imageCmd = static_cast<margelo::nitro::RNSkiaYoga::ImageCmd*>(_command.get());
        if (!imageCmd) {
            break;
        }

        if (props.hasProperty(runtime, "image")) {
            const auto imageValue = props.getProperty(runtime, "image");
            auto image = JSIConverter<sk_sp<SkImage>>::fromJSI(runtime, imageValue);
            if (image) {
                imageCmd->props.image = image;
            } else {
                imageCmd->props.image.reset();
            }
        }

        if (props.hasProperty(runtime, "sampling")) {
            const auto samplingValue = props.getProperty(runtime, "sampling");
            if (samplingValue.isNull() || samplingValue.isUndefined()) {
                imageCmd->props.sampling.reset();
            } else {
                imageCmd->props.sampling = RNSkia::SamplingOptionsFromValue(runtime, samplingValue);
            }
        }

        if (props.hasProperty(runtime, "fit")) {
            const auto fitValue = props.getProperty(runtime, "fit");
            if (fitValue.isString()) {
                imageCmd->props.fit = fitValue.asString(runtime).utf8(runtime);
            }
        } else if (imageCmd->props.fit.empty()) {
            imageCmd->props.fit = "contain";
        }

        break;
    }
    case NodeType::GROUP:
    default: {
    }
    }

    return jsi::Value::undefined();
}

jsi::Value YogaNode::draw(jsi::Runtime& runtime, const jsi::Value& thisArg, const jsi::Value* args, size_t count)
{
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

    ctx.canvas->save();
    ctx.canvas->translate(_layout.left, _layout.top);

    if (_matrix) {
        ctx.canvas->concat(*_matrix);
    }

    if (_clipPath.has_value()) {
        ctx.canvas->clipPath(*_clipPath, op, true);
    } else if (_clipRect.has_value()) {
        ctx.canvas->clipRect(*_clipRect, op, true);
    } else if (_clipRRect.has_value()) {
        ctx.canvas->clipRRect(*_clipRRect, op, true);
    }

    ctx.pushPaint(_paint);

    _command->draw(&ctx);

    for (const auto& child : _children) {
        if (child->_command) {
            child->drawInternal(ctx);
        }
    }

    ctx.restorePaint();

    ctx.canvas->restore();
}

void YogaNode::setChildren(const std::vector<std::shared_ptr<margelo::nitro::RNSkiaYoga::HybridYogaNodeSpec>>& children)
{
    _children.clear();
    _children.reserve(children.size());
    YGNodeRemoveAllChildren(_node);

    for (const auto& c : children) {
        auto yogaNode = std::dynamic_pointer_cast<YogaNode>(c);
        _children.push_back(yogaNode);
        YGNodeInsertChild(_node, yogaNode->_node, YGNodeGetChildCount(_node));
    }
}

std::vector<std::shared_ptr<margelo::nitro::RNSkiaYoga::HybridYogaNodeSpec>> YogaNode::getChildren()
{
    std::vector<std::shared_ptr<margelo::nitro::RNSkiaYoga::HybridYogaNodeSpec>> result;
    // result.reserve(_children.size());

    // std::transform(_children.begin(), _children.end(), std::back_inserter(result),
    //     [](auto& child) {
    //         return std::static_pointer_cast<margelo::nitro::RNSkiaYoga::HybridYogaNodeSpec>(child);
    //     });

    return result;
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

    if (_clipRRect) {
        std::array<SkVector, 4> radii;
        radii.fill(SkVector::Make(0.0f, 0.0f));

        if (_clipRRectRadii) {
            radii = *_clipRRectRadii;
        } else {
            auto currentRadii = _clipRRect->radii();
            for (size_t i = 0; i < radii.size(); ++i) {
                radii[i] = currentRadii[i];
            }
        }

        _clipRRect->setRectRadii(SkRect::MakeXYWH(_layout.left, _layout.top, _layout.width, _layout.height), radii.data());
    }

    if (_clipRect) {
        _clipRect->setWH(_layout.width, _layout.height);
    }

    for (const auto& child : _children) {
        child->recursiveSetLayout();
    }
}

void YogaNode::setLayout(const YogaNodeLayout& layout)
{

    throw std::runtime_error("Setting layout is not supported");
}

YogaNodeLayout YogaNode::getLayout()
{
    return _layout;
}

} // namespace margelo::nitro::RNSkiaYoga
