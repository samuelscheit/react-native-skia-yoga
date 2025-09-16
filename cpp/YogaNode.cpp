#include "YogaNode.hpp"
#include "ColorParser.hpp"
#include "HybridSkiaYogaSpec.hpp"
#include "HybridYogaNodeSpec.hpp"
#include "SkColor.h"
#include "SkiaYoga.hpp"
#include <jsi/jsi.h>
#include <react-native-skia/cpp/api/JsiSkCanvas.h>
#include <react-native-skia/cpp/api/JsiSkHostObjects.h>
#include <react-native-skia/cpp/api/recorder/DrawingCtx.h>
#include <react-native-skia/cpp/api/recorder/Drawings.h>
#include <react-native-skia/cpp/rnskia/RNSkManager.h>
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
        YGNodeStyleSetBorder(_node, YGEdgeAll, static_cast<float>(*value));
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
    _type = type;
}

jsi::Value YogaNode::setProps(jsi::Runtime& runtime, const jsi::Value& thisArg, const jsi::Value* args, size_t count)
{
    jsi::Object props = args[0].asObject(runtime);

    RNSkia::Variables variables; // TODO: save reanimated shared values

    switch (this->_type) {
    case NodeType::RECT: {
        auto* rectCmd = new margelo::nitro::RNSkiaYoga::RectCmd(this, runtime, props, variables);
        _command.reset(rectCmd);
        break;
    }
    case NodeType::TEXT: {
        auto* textCmd = new margelo::nitro::RNSkiaYoga::TextCmd(this, runtime, props, variables);
        _command.reset(textCmd);
        break;
    }
    case NodeType::PARAGRAPH: {
        auto* paragraphCmd = new margelo::nitro::RNSkiaYoga::ParagraphCmd(this, runtime, props, variables);
        _command.reset(paragraphCmd);
        break;
    }
    case NodeType::GROUP:
    default:
        break;

        //   _command = std::make_unique<RNSkia::GroupCmd>(runtime, props, variables);
    }

    if (_command) {
        _command->setLayout(_layout);
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

    ctx.pushPaint(_paint);

    _command->draw(&ctx);

    ctx.restorePaint();

    for (const auto& child : _children) {
        if (child->_command) {
            child->_command->draw(&ctx);
        }
    }

    // getObject()->play(&ctx);

    auto picture = pictureRecorder.finishRecordingAsPicture();
    return jsi::Object::createFromHostObject(runtime, std::make_shared<RNSkia::JsiSkPicture>(margelo::nitro::RNSkiaYoga::SkiaYoga::getPlatformContext(), picture));
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
