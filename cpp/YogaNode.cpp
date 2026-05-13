#include "YogaNode.hpp"
#include "ColorParser.hpp"
#include "HybridSkiaYogaSpec.hpp"
#include "HybridYogaNodeSpec.hpp"
#include <include/core/SkColor.h>
#include "SkiaYoga.hpp"
#include <array>
#include <cmath>
#include <functional>
#include <jsi/jsi.h>
#include <limits>
#include <optional>
#include <string>
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
#include "PlatformContextAccessor.hpp"
#include <modules/skparagraph/include/FontCollection.h>
#include <modules/skparagraph/include/ParagraphBuilder.h>
#include <modules/skparagraph/include/ParagraphStyle.h>
#include <type_traits>
#include <variant>
#include <yoga/Yoga.h>
#include <cstdlib>
#include <stdexcept>
#include <string_view>

namespace margelo::nitro::RNSkiaYoga {

using namespace facebook;

namespace {

std::recursive_mutex& yogaTreeMutex()
{
    static std::recursive_mutex mutex;
    return mutex;
}

template <typename Fn>
jsi::Value withJsiError(jsi::Runtime& runtime, const char* name, Fn&& fn)
{
    try {
        return fn();
    } catch (const jsi::JSError&) {
        throw;
    } catch (const std::exception& error) {
        throw jsi::JSError(
            runtime,
            std::string(name) + " failed. cause=" + error.what());
    } catch (...) {
        throw jsi::JSError(
            runtime,
            std::string(name) + " failed. cause=Unknown native error");
    }
}

template <typename>
inline constexpr bool alwaysFalse = false;

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

YGNodeRef defaultYogaStyleNode()
{
    static YGNodeRef defaultNode = YGNodeNew();
    return defaultNode;
}

void resetYogaStyle(YGNodeRef node)
{
    YGNodeCopyStyle(node, defaultYogaStyleNode());
}

std::shared_ptr<YogaNode> sharedYogaNodeForInsert(YogaNode& node)
{
    try {
        return node.shared_cast<YogaNode>();
    } catch (const std::exception& error) {
        throw std::runtime_error(
            std::string("YogaNode.insertChild() requires the parent YogaNode to be shared-owned. cause=") + error.what());
    }
}

std::optional<size_t> findChildIndex(const YogaNode& parent, const YogaNode& child)
{
    for (size_t i = 0; i < parent._children.size(); ++i) {
        if (parent._children[i].get() == &child) {
            return i;
        }
    }
    return std::nullopt;
}

bool isAncestorOrSelf(const YogaNode& maybeAncestor, const YogaNode& node)
{
    if (&maybeAncestor == &node) {
        return true;
    }

    auto parent = node._parent.lock();
    while (parent) {
        if (parent.get() == &maybeAncestor) {
            return true;
        }
        parent = parent->_parent.lock();
    }

    return false;
}

size_t eraseChildReferences(YogaNode& parent, const std::shared_ptr<YogaNode>& child)
{
    const auto oldSize = parent._children.size();
    parent._children.erase(
        std::remove_if(
            parent._children.begin(),
            parent._children.end(),
            [&](const std::shared_ptr<YogaNode>& candidate) {
                return candidate.get() == child.get();
            }),
        parent._children.end());
    return oldSize - parent._children.size();
}

size_t detachChildFromParent(YogaNode& parent, const std::shared_ptr<YogaNode>& child)
{
    if (!child) {
        return 0;
    }

    const bool hadYogaParent = parent._node != nullptr && child->_node != nullptr && YGNodeGetParent(child->_node) == parent._node;
    const auto currentParent = child->_parent.lock();
    const bool hadParentLink = currentParent && currentParent.get() == &parent;
    const auto removedCount = eraseChildReferences(parent, child);
    if (hadYogaParent) {
        YGNodeRemoveChild(parent._node, child->_node);
    }

    if (removedCount == 0 && !hadYogaParent && !hadParentLink) {
        return 0;
    }

    if (hadYogaParent || hadParentLink || removedCount > 0) {
        child->_parent.reset();
    }

    if (removedCount > 0) {
        const auto removedInteractiveDescendants = child->_interactiveDescendantCount * static_cast<int>(removedCount);
        parent.adjustInteractiveDescendantCount(-removedInteractiveDescendants);
    }
    parent.invalidateLayout();
    return removedCount;
}

void detachAllChildren(YogaNode& parent, bool propagateInvalidation)
{
    int removedInteractiveDescendants = 0;
    for (const auto& child : parent._children) {
        if (!child) {
            continue;
        }
        removedInteractiveDescendants += child->_interactiveDescendantCount;
        if (!propagateInvalidation) {
            child->_parent.reset();
        } else if (auto currentParent = child->_parent.lock()) {
            if (currentParent.get() == &parent) {
                child->_parent.reset();
            }
        } else {
            child->_parent.reset();
        }
    }

    if (parent._node != nullptr) {
        YGNodeRemoveAllChildren(parent._node);
    }

    parent._children.clear();

    if (propagateInvalidation) {
        parent.adjustInteractiveDescendantCount(-removedInteractiveDescendants);
        parent.invalidateLayout();
    }
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

[[noreturn]] static void throwInvalidHitSlopNumber(const char* propertyPath)
{
    throw std::invalid_argument(
        std::string("Invalid hitSlop value for ") + propertyPath +
        ": expected a finite native float.");
}

[[noreturn]] static void throwInvalidYogaNodeMethodNumber(const char* propertyPath)
{
    throw std::invalid_argument(
        std::string("Invalid numeric YogaNode method value for ") + propertyPath +
        ": expected a finite native float.");
}

[[noreturn]] static void throwInvalidEventTag()
{
    throw std::invalid_argument(
        "Invalid eventTag value: expected 0 or a positive JavaScript safe integer.");
}

double toValidEventTag(double value)
{
    constexpr auto maxSafeInteger = 9007199254740991.0;
    if (!std::isfinite(value) || value < 0.0 || value > maxSafeInteger || std::trunc(value) != value) {
        throwInvalidEventTag();
    }
    return value;
}

float toFiniteYogaNodeMethodFloat(double value, const char* propertyPath)
{
    if (!std::isfinite(value) || std::abs(value) > static_cast<double>(std::numeric_limits<float>::max())) {
        throwInvalidYogaNodeMethodNumber(propertyPath);
    }
    return static_cast<float>(value);
}

float toFiniteHitSlopFloat(double value, const char* propertyPath)
{
    if (!std::isfinite(value) || std::abs(value) > static_cast<double>(std::numeric_limits<float>::max())) {
        throwInvalidHitSlopNumber(propertyPath);
    }
    return static_cast<float>(value);
}

float addHitSlopValues(float value, float axis, const char* propertyPath)
{
    const auto result = static_cast<double>(value) + static_cast<double>(axis);
    return toFiniteHitSlopFloat(result, propertyPath);
}

float getHitSlopNumericProperty(
    jsi::Runtime& runtime,
    const jsi::Object& object,
    const char* key,
    const char* propertyPath,
    float fallback)
{
    if (!object.hasProperty(runtime, key)) {
        return fallback;
    }

    const auto value = object.getProperty(runtime, key);
    if (!value.isNumber()) {
        return fallback;
    }

    return toFiniteHitSlopFloat(value.asNumber(), propertyPath);
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

} // namespace

YogaNode::~YogaNode()
{
    std::lock_guard<std::recursive_mutex> lock(yogaTreeMutex());
    detachAllChildren(*this, false);
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

static bool isAsciiDigit(char value)
{
    return value >= '0' && value <= '9';
}

static bool isFiniteDecimalNumberText(std::string_view value)
{
    if (value.empty()) {
        return false;
    }

    size_t index = 0;
    if (value[index] == '+' || value[index] == '-') {
        ++index;
        if (index == value.size()) {
            return false;
        }
    }

    bool hasMantissaDigit = false;
    while (index < value.size() && isAsciiDigit(value[index])) {
        hasMantissaDigit = true;
        ++index;
    }

    if (index < value.size() && value[index] == '.') {
        ++index;
        while (index < value.size() && isAsciiDigit(value[index])) {
            hasMantissaDigit = true;
            ++index;
        }
    }

    if (!hasMantissaDigit) {
        return false;
    }

    if (index < value.size() && (value[index] == 'e' || value[index] == 'E')) {
        ++index;
        if (index < value.size() && (value[index] == '+' || value[index] == '-')) {
            ++index;
        }

        bool hasExponentDigit = false;
        while (index < value.size() && isAsciiDigit(value[index])) {
            hasExponentDigit = true;
            ++index;
        }
        if (!hasExponentDigit) {
            return false;
        }
    }

    return index == value.size();
}

static std::string yogaLayoutValueExpectation(bool acceptsPercent, bool acceptsAuto, bool acceptsWidthSpecial)
{
    std::string expected = "a number";
    if (acceptsPercent) {
        expected += " or a finite percentage string";
    }
    if (acceptsAuto) {
        expected += " or \"auto\"";
    }
    if (acceptsWidthSpecial) {
        expected += " or \"fit-content\", \"max-content\", or \"stretch\"";
    }
    return expected;
}

[[noreturn]] static void throwInvalidYogaLayoutString(
    const char* propertyName,
    const std::string& value,
    bool acceptsPercent,
    bool acceptsAuto,
    bool acceptsWidthSpecial)
{
    throw std::invalid_argument(
        std::string("Invalid Yoga layout value for ") + propertyName +
        ": \"" + value + "\". Expected " +
        yogaLayoutValueExpectation(acceptsPercent, acceptsAuto, acceptsWidthSpecial) + ".");
}

[[noreturn]] static void throwInvalidBackgroundColorString(const std::string& value)
{
    throw std::invalid_argument(
        "Invalid CSS color string for backgroundColor: \"" + value + "\".");
}

[[noreturn]] static void throwInvalidNumericStyleValue(const std::string& propertyName)
{
    throw std::invalid_argument(
        "Invalid numeric style value for " + propertyName +
        ": expected a finite number.");
}

[[noreturn]] static void throwInvalidNumericStyleValue(const char* propertyName)
{
    throwInvalidNumericStyleValue(std::string(propertyName));
}

static bool isFiniteNativeStyleFloat(double value)
{
    return std::isfinite(value) &&
        std::abs(value) <= static_cast<double>(std::numeric_limits<float>::max());
}

static void validateNativeStyleFloat(const std::string& propertyName, double value)
{
    if (!isFiniteNativeStyleFloat(value)) {
        throwInvalidNumericStyleValue(propertyName);
    }
}

static void validateNativeStyleFloat(const char* propertyName, double value)
{
    validateNativeStyleFloat(std::string(propertyName), value);
}

static float toNativeStyleFloat(const std::string& propertyName, double value)
{
    validateNativeStyleFloat(propertyName, value);
    return static_cast<float>(value);
}

static float toNativeStyleFloat(const char* propertyName, double value)
{
    return toNativeStyleFloat(std::string(propertyName), value);
}

static float parseYogaPercent(
    const char* propertyName,
    const std::string& value,
    bool acceptsAuto,
    bool acceptsWidthSpecial)
{
    if (value.size() < 2 || value.back() != '%') {
        throwInvalidYogaLayoutString(propertyName, value, true, acceptsAuto, acceptsWidthSpecial);
    }

    const std::string_view numberText(value.data(), value.size() - 1);
    if (!isFiniteDecimalNumberText(numberText)) {
        throwInvalidYogaLayoutString(propertyName, value, true, acceptsAuto, acceptsWidthSpecial);
    }

    const std::string numberString(numberText);
    char* end = nullptr;
    const double parsed = std::strtod(numberString.c_str(), &end);
    const bool consumedAll = end == numberString.c_str() + numberString.size();
    if (!consumedAll || !isFiniteNativeStyleFloat(parsed)) {
        throwInvalidYogaLayoutString(propertyName, value, true, acceptsAuto, acceptsWidthSpecial);
    }

    return static_cast<float>(parsed);
}

static void validateYGValueOrPercent(
    const char* propertyName,
    const std::variant<std::string, double>& value,
    bool acceptsPercent,
    bool acceptsAuto,
    bool acceptsWidthSpecial = false)
{
    if (!std::holds_alternative<std::string>(value)) {
        return;
    }

    const auto& strValue = std::get<std::string>(value);
    if (strValue == "auto") {
        if (acceptsAuto) {
            return;
        }
        throwInvalidYogaLayoutString(propertyName, strValue, acceptsPercent, acceptsAuto, acceptsWidthSpecial);
    }

    if (!strValue.empty() && strValue.back() == '%') {
        if (acceptsPercent) {
            parseYogaPercent(propertyName, strValue, acceptsAuto, acceptsWidthSpecial);
            return;
        }
        throwInvalidYogaLayoutString(propertyName, strValue, acceptsPercent, acceptsAuto, acceptsWidthSpecial);
    }

    throwInvalidYogaLayoutString(propertyName, strValue, acceptsPercent, acceptsAuto, acceptsWidthSpecial);
}

static bool isYGWidthSpecialValue(const std::string& value)
{
    return value == "fit-content" || value == "max-content" || value == "stretch";
}

static bool applyYGWidthSpecialValue(YGNodeRef node, const std::string& value)
{
    if (value == "fit-content") {
        YGNodeStyleSetWidthFitContent(node);
        return true;
    }
    if (value == "max-content") {
        YGNodeStyleSetWidthMaxContent(node);
        return true;
    }
    if (value == "stretch") {
        YGNodeStyleSetWidthStretch(node);
        return true;
    }
    return false;
}

static void validateYGWidthValue(const std::variant<std::string, double>& value)
{
    if (std::holds_alternative<std::string>(value) && isYGWidthSpecialValue(std::get<std::string>(value))) {
        return;
    }

    validateYGValueOrPercent("width", value, true, true, true);
}

static void validateYogaLayoutUnitStrings(const NodeStyle& style)
{
    auto validateValue = [](const char* propertyName,
                             const std::optional<std::variant<std::string, double>>& value,
                             bool acceptsAuto) {
        if (value) {
            validateYGValueOrPercent(propertyName, *value, true, acceptsAuto);
        }
    };

    validateValue("flexBasis", style.flexBasis, true);
    if (style.width) {
        validateYGWidthValue(*style.width);
    }
    validateValue("height", style.height, true);
    validateValue("minWidth", style.minWidth, false);
    validateValue("minHeight", style.minHeight, false);
    validateValue("maxWidth", style.maxWidth, false);
    validateValue("maxHeight", style.maxHeight, false);

    validateValue("top", style.top, true);
    validateValue("bottom", style.bottom, true);
    validateValue("left", style.left, true);
    validateValue("right", style.right, true);
    validateValue("start", style.start, true);
    validateValue("end", style.end, true);

    validateValue("margin", style.margin, true);
    validateValue("marginTop", style.marginTop, true);
    validateValue("marginBottom", style.marginBottom, true);
    validateValue("marginLeft", style.marginLeft, true);
    validateValue("marginRight", style.marginRight, true);
    validateValue("marginStart", style.marginStart, true);
    validateValue("marginEnd", style.marginEnd, true);
    validateValue("marginHorizontal", style.marginHorizontal, true);
    validateValue("marginVertical", style.marginVertical, true);

    validateValue("padding", style.padding, false);
    validateValue("paddingTop", style.paddingTop, false);
    validateValue("paddingBottom", style.paddingBottom, false);
    validateValue("paddingLeft", style.paddingLeft, false);
    validateValue("paddingRight", style.paddingRight, false);
    validateValue("paddingStart", style.paddingStart, false);
    validateValue("paddingEnd", style.paddingEnd, false);
    validateValue("paddingHorizontal", style.paddingHorizontal, false);
    validateValue("paddingVertical", style.paddingVertical, false);

    validateValue("inset", style.inset, true);
    validateValue("insetHorizontal", style.insetHorizontal, true);
    validateValue("insetVertical", style.insetVertical, true);
}

static void validateBackgroundColorString(const NodeStyle& style)
{
    if (!style.backgroundColor.has_value()) {
        return;
    }

    const auto& value = *style.backgroundColor;
    if (!std::holds_alternative<std::string>(value)) {
        return;
    }

    const auto& color = std::get<std::string>(value);
    if (!parseCssColor(color).has_value()) {
        throwInvalidBackgroundColorString(color);
    }
}

static void validateFiniteStyleNumber(const char* propertyName, const std::optional<double>& value)
{
    if (value.has_value()) {
        validateNativeStyleFloat(propertyName, *value);
    }
}

static void validateFiniteStyleNumber(
    const char* propertyName,
    const std::optional<std::variant<std::string, double>>& value)
{
    if (!value.has_value() || !std::holds_alternative<double>(*value)) {
        return;
    }

    validateNativeStyleFloat(propertyName, std::get<double>(*value));
}

static void validateFiniteNumericStyleFields(const NodeStyle& style)
{
    validateFiniteStyleNumber("borderBottomWidth", style.borderBottomWidth);
    validateFiniteStyleNumber("borderEndWidth", style.borderEndWidth);
    validateFiniteStyleNumber("borderLeftWidth", style.borderLeftWidth);
    validateFiniteStyleNumber("borderRightWidth", style.borderRightWidth);
    validateFiniteStyleNumber("borderStartWidth", style.borderStartWidth);
    validateFiniteStyleNumber("borderTopWidth", style.borderTopWidth);
    validateFiniteStyleNumber("borderWidth", style.borderWidth);
    validateFiniteStyleNumber("borderHorizontalWidth", style.borderHorizontalWidth);
    validateFiniteStyleNumber("borderVerticalWidth", style.borderVerticalWidth);
    validateFiniteStyleNumber("strokeMiter", style.strokeMiter);
    validateFiniteStyleNumber("opacity", style.opacity);

    validateFiniteStyleNumber("aspectRatio", style.aspectRatio);
    validateFiniteStyleNumber("flex", style.flex);
    validateFiniteStyleNumber("flexGrow", style.flexGrow);
    validateFiniteStyleNumber("flexShrink", style.flexShrink);
    validateFiniteStyleNumber("gap", style.gap);
    validateFiniteStyleNumber("rowGap", style.rowGap);
    validateFiniteStyleNumber("columnGap", style.columnGap);

    validateFiniteStyleNumber("flexBasis", style.flexBasis);
    validateFiniteStyleNumber("width", style.width);
    validateFiniteStyleNumber("height", style.height);
    validateFiniteStyleNumber("minWidth", style.minWidth);
    validateFiniteStyleNumber("minHeight", style.minHeight);
    validateFiniteStyleNumber("maxWidth", style.maxWidth);
    validateFiniteStyleNumber("maxHeight", style.maxHeight);

    validateFiniteStyleNumber("top", style.top);
    validateFiniteStyleNumber("right", style.right);
    validateFiniteStyleNumber("bottom", style.bottom);
    validateFiniteStyleNumber("left", style.left);
    validateFiniteStyleNumber("start", style.start);
    validateFiniteStyleNumber("end", style.end);

    validateFiniteStyleNumber("margin", style.margin);
    validateFiniteStyleNumber("marginTop", style.marginTop);
    validateFiniteStyleNumber("marginBottom", style.marginBottom);
    validateFiniteStyleNumber("marginLeft", style.marginLeft);
    validateFiniteStyleNumber("marginRight", style.marginRight);
    validateFiniteStyleNumber("marginStart", style.marginStart);
    validateFiniteStyleNumber("marginEnd", style.marginEnd);
    validateFiniteStyleNumber("marginHorizontal", style.marginHorizontal);
    validateFiniteStyleNumber("marginVertical", style.marginVertical);

    validateFiniteStyleNumber("padding", style.padding);
    validateFiniteStyleNumber("paddingTop", style.paddingTop);
    validateFiniteStyleNumber("paddingBottom", style.paddingBottom);
    validateFiniteStyleNumber("paddingLeft", style.paddingLeft);
    validateFiniteStyleNumber("paddingRight", style.paddingRight);
    validateFiniteStyleNumber("paddingStart", style.paddingStart);
    validateFiniteStyleNumber("paddingEnd", style.paddingEnd);
    validateFiniteStyleNumber("paddingHorizontal", style.paddingHorizontal);
    validateFiniteStyleNumber("paddingVertical", style.paddingVertical);

    validateFiniteStyleNumber("inset", style.inset);
    validateFiniteStyleNumber("insetHorizontal", style.insetHorizontal);
    validateFiniteStyleNumber("insetVertical", style.insetVertical);
}

static void validateFiniteCornerRadius(
    const char* propertyName,
    const std::optional<std::variant<double, SkPoint>>& value)
{
    if (!value.has_value()) {
        return;
    }

    if (std::holds_alternative<double>(*value)) {
        validateNativeStyleFloat(propertyName, std::get<double>(*value));
        return;
    }

    const auto& point = std::get<SkPoint>(*value);
    validateNativeStyleFloat(std::string(propertyName) + ".x", point.x);
    validateNativeStyleFloat(std::string(propertyName) + ".y", point.y);
}

static void validateFiniteRadiusStyleFields(const NodeStyle& style)
{
    validateFiniteStyleNumber("borderRadius", style.borderRadius);
    validateFiniteCornerRadius("borderTopLeftRadius", style.borderTopLeftRadius);
    validateFiniteCornerRadius("borderTopRightRadius", style.borderTopRightRadius);
    validateFiniteCornerRadius("borderBottomRightRadius", style.borderBottomRightRadius);
    validateFiniteCornerRadius("borderBottomLeftRadius", style.borderBottomLeftRadius);
}

static void validateFiniteMatrixElement(size_t index, double value)
{
    validateNativeStyleFloat("matrix[" + std::to_string(index) + "]", value);
}

static void validateFiniteSkMatrix(const std::shared_ptr<SkMatrix>& matrix)
{
    if (!matrix) {
        return;
    }

    for (int i = 0; i < 9; ++i) {
        validateFiniteMatrixElement(static_cast<size_t>(i), static_cast<double>(matrix->get(i)));
    }
}

template <typename Tuple, std::size_t... Indices>
static void validateFiniteMatrixTupleImpl(const Tuple& tuple, std::index_sequence<Indices...>)
{
    (validateFiniteMatrixElement(Indices, std::get<Indices>(tuple)), ...);
}

template <typename Tuple>
static void validateFiniteMatrixTuple(const Tuple& tuple)
{
    validateFiniteMatrixTupleImpl(
        tuple,
        std::make_index_sequence<std::tuple_size_v<std::decay_t<Tuple>>> {});
}

template <typename MatrixStyleValue>
static void validateFiniteMatrixStyleValue(const MatrixStyleValue& matrixValue)
{
    std::visit(
        [](const auto& value) {
            using T = std::decay_t<decltype(value)>;

            if constexpr (std::is_same_v<T, std::shared_ptr<SkMatrix>>) {
                validateFiniteSkMatrix(value);
            } else if constexpr (std::tuple_size_v<T> == 9 || std::tuple_size_v<T> == 16) {
                validateFiniteMatrixTuple(value);
            } else {
                static_assert(alwaysFalse<T>, "Unsupported matrix style value");
            }
        },
        matrixValue);
}

static void validateFiniteTransformLeaf(const char* propertyName, double value)
{
    validateNativeStyleFloat(propertyName, value);
}

template <typename TransformStyleValue>
static void validateFiniteTransformOperation(const TransformStyleValue& transform)
{
    std::visit(
        [](const auto& op) {
            using T = std::decay_t<decltype(op)>;

            if constexpr (std::is_same_v<T, TransformRotateX>) {
                validateFiniteTransformLeaf("transform.rotateX", op.rotateX);
            } else if constexpr (std::is_same_v<T, TransformRotateY>) {
                validateFiniteTransformLeaf("transform.rotateY", op.rotateY);
            } else if constexpr (std::is_same_v<T, TransformRotateZ>) {
                validateFiniteTransformLeaf("transform.rotateZ", op.rotateZ);
            } else if constexpr (std::is_same_v<T, TransformScale>) {
                validateFiniteTransformLeaf("transform.scale", op.scale);
            } else if constexpr (std::is_same_v<T, TransformScaleX>) {
                validateFiniteTransformLeaf("transform.scaleX", op.scaleX);
            } else if constexpr (std::is_same_v<T, TransformScaleY>) {
                validateFiniteTransformLeaf("transform.scaleY", op.scaleY);
            } else if constexpr (std::is_same_v<T, TransformTranslateX>) {
                validateFiniteTransformLeaf("transform.translateX", op.translateX);
            } else if constexpr (std::is_same_v<T, TransformTranslateY>) {
                validateFiniteTransformLeaf("transform.translateY", op.translateY);
            } else if constexpr (std::is_same_v<T, TransformSkewX>) {
                validateFiniteTransformLeaf("transform.skewX", op.skewX);
            } else if constexpr (std::is_same_v<T, TransformSkewY>) {
                validateFiniteTransformLeaf("transform.skewY", op.skewY);
            } else {
                static_assert(alwaysFalse<T>, "Unsupported transform operation");
            }
        },
        transform);
}

static void validateFiniteMatrixAndTransformStyleFields(const NodeStyle& style)
{
    if (style.matrix.has_value()) {
        validateFiniteMatrixStyleValue(*style.matrix);
    }

    if (!style.transform.has_value()) {
        return;
    }

    for (const auto& transform : *style.transform) {
        validateFiniteTransformOperation(transform);
    }
}

// Helper function to handle variant<string, double> values for setting yoga values
static void setYGValueOrPercent(void (*setter)(YGNodeRef, float),
    void (*percentSetter)(YGNodeRef, float),
    void (*autoSetter)(YGNodeRef),
    YGNodeRef node,
    const std::variant<std::string, double>& value,
    const char* propertyName,
    bool acceptsWidthSpecial = false)
{
    if (std::holds_alternative<std::string>(value)) {
        const std::string& strValue = std::get<std::string>(value);
        const bool acceptsPercent = percentSetter != nullptr;
        const bool acceptsAuto = autoSetter != nullptr;
        validateYGValueOrPercent(propertyName, value, acceptsPercent, acceptsAuto, acceptsWidthSpecial);
        if (strValue == "auto") {
            autoSetter(node);
        } else if (!strValue.empty() && strValue.back() == '%') {
            const float percent = parseYogaPercent(propertyName, strValue, acceptsAuto, acceptsWidthSpecial);
            percentSetter(node, percent);
        }
    } else {
        float numValue = toNativeStyleFloat(propertyName, std::get<double>(value));
        setter(node, numValue);
    }
}

// Helper function for edge-based properties (margin, padding, etc.)
static void setYGEdgeValue(void (*setter)(YGNodeRef, YGEdge, float),
    void (*percentSetter)(YGNodeRef, YGEdge, float),
    void (*autoSetter)(YGNodeRef, YGEdge),
    YGNodeRef node,
    YGEdge edge,
    const std::variant<std::string, double>& value,
    const char* propertyName)
{
    if (std::holds_alternative<std::string>(value)) {
        const std::string& strValue = std::get<std::string>(value);
        const bool acceptsPercent = percentSetter != nullptr;
        const bool acceptsAuto = autoSetter != nullptr;
        validateYGValueOrPercent(propertyName, value, acceptsPercent, acceptsAuto);
        if (strValue == "auto") {
            autoSetter(node, edge);
        } else if (!strValue.empty() && strValue.back() == '%') {
            const float percent = parseYogaPercent(propertyName, strValue, acceptsAuto, false);
            percentSetter(node, edge, percent);
        }
    } else {
        float numValue = toNativeStyleFloat(propertyName, std::get<double>(value));
        setter(node, edge, numValue);
    }
}

static void setYGWidthValue(YGNodeRef node, const std::variant<std::string, double>& value)
{
    if (std::holds_alternative<std::string>(value)) {
        const auto& strValue = std::get<std::string>(value);
        if (applyYGWidthSpecialValue(node, strValue)) {
            return;
        }
    }

    setYGValueOrPercent(YGNodeStyleSetWidth, YGNodeStyleSetWidthPercent,
        YGNodeStyleSetWidthAuto, node, value, "width", true);
}

void YogaNode::setStyle(const NodeStyle& style)
{
    std::lock_guard<std::recursive_mutex> lock(yogaTreeMutex());
    validateYogaLayoutUnitStrings(style);
    validateBackgroundColorString(style);
    validateFiniteNumericStyleFields(style);
    validateFiniteRadiusStyleFields(style);
    validateFiniteMatrixAndTransformStyleFields(style);
    invalidateLayout();
    _style = style;
    resetYogaStyle(_node);
    _paint = SkPaint();
    _layerPaint.reset();
    _clipsToBounds = false;
    _clipToBoundsRadii.reset();
    _clipPath.reset();
    _clipRect.reset();
    _clipRRect.reset();
    _matrix.reset();

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
        YGNodeStyleSetFlex(_node, toNativeStyleFloat("flex", *value));
    }

    if (const auto& value = style.flexGrow) {
        YGNodeStyleSetFlexGrow(_node, toNativeStyleFloat("flexGrow", *value));
    }

    if (const auto& value = style.flexShrink) {
        YGNodeStyleSetFlexShrink(_node, toNativeStyleFloat("flexShrink", *value));
    }

    if (const auto& value = style.flexBasis) {
        setYGValueOrPercent(YGNodeStyleSetFlexBasis, YGNodeStyleSetFlexBasisPercent,
            YGNodeStyleSetFlexBasisAuto, _node, *value, "flexBasis");
    }

    // Size properties
    if (const auto& value = style.width) {
        setYGWidthValue(_node, *value);
    } else if (_commandKind == YogaNodeCommandKind::PARAGRAPH) {
        // default width for paragraphs is to stretch but not beyond
        YGNodeStyleSetWidthStretch(_node);
    }

    if (const auto& value = style.height) {
        setYGValueOrPercent(YGNodeStyleSetHeight, YGNodeStyleSetHeightPercent,
            YGNodeStyleSetHeightAuto, _node, *value, "height");
    }

    if (const auto& value = style.minWidth) {
        setYGValueOrPercent(YGNodeStyleSetMinWidth, YGNodeStyleSetMinWidthPercent,
            nullptr, _node, *value, "minWidth");
    }

    if (const auto& value = style.minHeight) {
        setYGValueOrPercent(YGNodeStyleSetMinHeight, YGNodeStyleSetMinHeightPercent,
            nullptr, _node, *value, "minHeight");
    }

    if (const auto& value = style.maxWidth) {
        setYGValueOrPercent(YGNodeStyleSetMaxWidth, YGNodeStyleSetMaxWidthPercent,
            nullptr, _node, *value, "maxWidth");
    }

    if (const auto& value = style.maxHeight) {
        setYGValueOrPercent(YGNodeStyleSetMaxHeight, YGNodeStyleSetMaxHeightPercent,
            nullptr, _node, *value, "maxHeight");
    }

    // Aspect ratio
    if (const auto& value = style.aspectRatio) {
        YGNodeStyleSetAspectRatio(_node, toNativeStyleFloat("aspectRatio", *value));
    }

    // Position properties
    if (const auto& value = style.top) {
        setYGEdgeValue(YGNodeStyleSetPosition, YGNodeStyleSetPositionPercent,
            YGNodeStyleSetPositionAuto, _node, YGEdgeTop, *value, "top");
    }

    if (const auto& value = style.bottom) {
        setYGEdgeValue(YGNodeStyleSetPosition, YGNodeStyleSetPositionPercent,
            YGNodeStyleSetPositionAuto, _node, YGEdgeBottom, *value, "bottom");
    }

    if (const auto& value = style.left) {
        setYGEdgeValue(YGNodeStyleSetPosition, YGNodeStyleSetPositionPercent,
            YGNodeStyleSetPositionAuto, _node, YGEdgeLeft, *value, "left");
    }

    if (const auto& value = style.right) {
        setYGEdgeValue(YGNodeStyleSetPosition, YGNodeStyleSetPositionPercent,
            YGNodeStyleSetPositionAuto, _node, YGEdgeRight, *value, "right");
    }

    if (const auto& value = style.start) {
        setYGEdgeValue(YGNodeStyleSetPosition, YGNodeStyleSetPositionPercent,
            YGNodeStyleSetPositionAuto, _node, YGEdgeStart, *value, "start");
    }

    if (const auto& value = style.end) {
        setYGEdgeValue(YGNodeStyleSetPosition, YGNodeStyleSetPositionPercent,
            YGNodeStyleSetPositionAuto, _node, YGEdgeEnd, *value, "end");
    }

    // Margin properties
    if (const auto& value = style.margin) {
        setYGEdgeValue(YGNodeStyleSetMargin, YGNodeStyleSetMarginPercent,
            YGNodeStyleSetMarginAuto, _node, YGEdgeAll, *value, "margin");
    }

    if (const auto& value = style.marginTop) {
        setYGEdgeValue(YGNodeStyleSetMargin, YGNodeStyleSetMarginPercent,
            YGNodeStyleSetMarginAuto, _node, YGEdgeTop, *value, "marginTop");
    }

    if (const auto& value = style.marginBottom) {
        setYGEdgeValue(YGNodeStyleSetMargin, YGNodeStyleSetMarginPercent,
            YGNodeStyleSetMarginAuto, _node, YGEdgeBottom, *value, "marginBottom");
    }

    if (const auto& value = style.marginLeft) {
        setYGEdgeValue(YGNodeStyleSetMargin, YGNodeStyleSetMarginPercent,
            YGNodeStyleSetMarginAuto, _node, YGEdgeLeft, *value, "marginLeft");
    }

    if (const auto& value = style.marginRight) {
        setYGEdgeValue(YGNodeStyleSetMargin, YGNodeStyleSetMarginPercent,
            YGNodeStyleSetMarginAuto, _node, YGEdgeRight, *value, "marginRight");
    }

    if (const auto& value = style.marginStart) {
        setYGEdgeValue(YGNodeStyleSetMargin, YGNodeStyleSetMarginPercent,
            YGNodeStyleSetMarginAuto, _node, YGEdgeStart, *value, "marginStart");
    }

    if (const auto& value = style.marginEnd) {
        setYGEdgeValue(YGNodeStyleSetMargin, YGNodeStyleSetMarginPercent,
            YGNodeStyleSetMarginAuto, _node, YGEdgeEnd, *value, "marginEnd");
    }

    if (const auto& value = style.marginHorizontal) {
        setYGEdgeValue(YGNodeStyleSetMargin, YGNodeStyleSetMarginPercent,
            YGNodeStyleSetMarginAuto, _node, YGEdgeHorizontal, *value, "marginHorizontal");
    }

    if (const auto& value = style.marginVertical) {
        setYGEdgeValue(YGNodeStyleSetMargin, YGNodeStyleSetMarginPercent,
            YGNodeStyleSetMarginAuto, _node, YGEdgeVertical, *value, "marginVertical");
    }

    // Padding properties
    if (const auto& value = style.padding) {
        setYGEdgeValue(YGNodeStyleSetPadding, YGNodeStyleSetPaddingPercent,
            nullptr, _node, YGEdgeAll, *value, "padding");
    }

    if (const auto& value = style.paddingTop) {
        setYGEdgeValue(YGNodeStyleSetPadding, YGNodeStyleSetPaddingPercent,
            nullptr, _node, YGEdgeTop, *value, "paddingTop");
    }

    if (const auto& value = style.paddingBottom) {
        setYGEdgeValue(YGNodeStyleSetPadding, YGNodeStyleSetPaddingPercent,
            nullptr, _node, YGEdgeBottom, *value, "paddingBottom");
    }

    if (const auto& value = style.paddingLeft) {
        setYGEdgeValue(YGNodeStyleSetPadding, YGNodeStyleSetPaddingPercent,
            nullptr, _node, YGEdgeLeft, *value, "paddingLeft");
    }

    if (const auto& value = style.paddingRight) {
        setYGEdgeValue(YGNodeStyleSetPadding, YGNodeStyleSetPaddingPercent,
            nullptr, _node, YGEdgeRight, *value, "paddingRight");
    }

    if (const auto& value = style.paddingStart) {
        setYGEdgeValue(YGNodeStyleSetPadding, YGNodeStyleSetPaddingPercent,
            nullptr, _node, YGEdgeStart, *value, "paddingStart");
    }

    if (const auto& value = style.paddingEnd) {
        setYGEdgeValue(YGNodeStyleSetPadding, YGNodeStyleSetPaddingPercent,
            nullptr, _node, YGEdgeEnd, *value, "paddingEnd");
    }

    if (const auto& value = style.paddingHorizontal) {
        setYGEdgeValue(YGNodeStyleSetPadding, YGNodeStyleSetPaddingPercent,
            nullptr, _node, YGEdgeHorizontal, *value, "paddingHorizontal");
    }

    if (const auto& value = style.paddingVertical) {
        setYGEdgeValue(YGNodeStyleSetPadding, YGNodeStyleSetPaddingPercent,
            nullptr, _node, YGEdgeVertical, *value, "paddingVertical");
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

    // Border properties
    if (const auto& value = style.borderWidth) {
        auto val = toNativeStyleFloat("borderWidth", *value);
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
        YGNodeStyleSetBorder(_node, YGEdgeTop, toNativeStyleFloat("borderTopWidth", *value));
    }

    if (const auto& value = style.borderBottomWidth) {
        YGNodeStyleSetBorder(_node, YGEdgeBottom, toNativeStyleFloat("borderBottomWidth", *value));
    }

    if (const auto& value = style.borderLeftWidth) {
        YGNodeStyleSetBorder(_node, YGEdgeLeft, toNativeStyleFloat("borderLeftWidth", *value));
    }

    if (const auto& value = style.borderRightWidth) {
        YGNodeStyleSetBorder(_node, YGEdgeRight, toNativeStyleFloat("borderRightWidth", *value));
    }

    if (const auto& value = style.borderStartWidth) {
        YGNodeStyleSetBorder(_node, YGEdgeStart, toNativeStyleFloat("borderStartWidth", *value));
    }

    if (const auto& value = style.borderEndWidth) {
        YGNodeStyleSetBorder(_node, YGEdgeEnd, toNativeStyleFloat("borderEndWidth", *value));
    }

    if (const auto& value = style.borderHorizontalWidth) {
        float width = toNativeStyleFloat("borderHorizontalWidth", *value);
        YGNodeStyleSetBorder(_node, YGEdgeHorizontal, width);
    }

    if (const auto& value = style.borderVerticalWidth) {
        float width = toNativeStyleFloat("borderVerticalWidth", *value);
        YGNodeStyleSetBorder(_node, YGEdgeVertical, width);
    }

    // Gap properties
    if (const auto& value = style.gap) {
        YGNodeStyleSetGap(_node, YGGutterAll, toNativeStyleFloat("gap", *value));
    }

    if (const auto& value = style.rowGap) {
        YGNodeStyleSetGap(_node, YGGutterRow, toNativeStyleFloat("rowGap", *value));
    }

    if (const auto& value = style.columnGap) {
        YGNodeStyleSetGap(_node, YGGutterColumn, toNativeStyleFloat("columnGap", *value));
    }

    // Inset properties: TODO object
    if (const auto& value = style.inset) {
        // Apply to all edges
        setYGEdgeValue(YGNodeStyleSetPosition, YGNodeStyleSetPositionPercent,
            YGNodeStyleSetPositionAuto, _node, YGEdgeAll, *value, "inset");
    }

    if (const auto& value = style.insetHorizontal) {
        setYGEdgeValue(YGNodeStyleSetPosition, YGNodeStyleSetPositionPercent,
            YGNodeStyleSetPositionAuto, _node, YGEdgeHorizontal, *value, "insetHorizontal");
    }

    if (const auto& value = style.insetVertical) {
        setYGEdgeValue(YGNodeStyleSetPosition, YGNodeStyleSetPositionPercent,
            YGNodeStyleSetPositionAuto, _node, YGEdgeVertical, *value, "insetVertical");
    }

    if (const auto& value = style.layer) {
        _layerPaint = *value;
    }

    if (const auto& value = style.dither) {
        _paint.setDither(*value);
    }

    if (const auto& value = style.antiAlias.has_value() ? style.antiAlias : style.antiaAlias) {
        _paint.setAntiAlias(*value);
    }

    if (const auto& value = style.opacity) {
        _paint.setAlphaf(toNativeStyleFloat("opacity", *value));
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
            auto radius = toNativeStyleFloat("borderRadius", *value);
            radii[SkRRect::kUpperLeft_Corner] = SkVector::Make(radius, radius);
            radii[SkRRect::kUpperRight_Corner] = SkVector::Make(radius, radius);
            radii[SkRRect::kLowerRight_Corner] = SkVector::Make(radius, radius);
            radii[SkRRect::kLowerLeft_Corner] = SkVector::Make(radius, radius);

            shouldClipToBounds = true;
        }

        auto setCornerRadius = [&](const auto& val, int corner, const char* propertyName) {
            if (val) {
                if (std::holds_alternative<SkPoint>(*val)) {
                    SkPoint p = std::get<SkPoint>(*val);
                    const auto x = toNativeStyleFloat(std::string(propertyName) + ".x", p.x);
                    const auto y = toNativeStyleFloat(std::string(propertyName) + ".y", p.y);
                    radii[corner] = SkVector::Make(x, y);
                } else {
                    auto radius = toNativeStyleFloat(propertyName, std::get<double>(*val));
                    radii[corner] = SkVector::Make(radius, radius);
                }
                shouldClipToBounds = true;
            }
        };

        setCornerRadius(style.borderTopLeftRadius, SkRRect::kUpperLeft_Corner, "borderTopLeftRadius");
        setCornerRadius(style.borderTopRightRadius, SkRRect::kUpperRight_Corner, "borderTopRightRadius");
        setCornerRadius(style.borderBottomRightRadius, SkRRect::kLowerRight_Corner, "borderBottomRightRadius");
        setCornerRadius(style.borderBottomLeftRadius, SkRRect::kLowerLeft_Corner, "borderBottomLeftRadius");

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

    auto applyMatrixStyle = [&]() {
        if (const auto& value = style.matrix) {
            _matrix = makeMatrixPointer(*value);
        } else {
            _matrix.reset();
        }
    };

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
                        rotate.setRotateUnit({ 1.0f, 0.0f, 0.0f }, toNativeStyleFloat("transform.rotateX", op.rotateX));
                        matrix.preConcat(rotate);
                        hasTransform = true;
                    } else if constexpr (std::is_same_v<T, TransformRotateY>) {
                        SkM44 rotate;
                        rotate.setRotateUnit({ 0.0f, 1.0f, 0.0f }, toNativeStyleFloat("transform.rotateY", op.rotateY));
                        matrix.preConcat(rotate);
                        hasTransform = true;
                    } else if constexpr (std::is_same_v<T, TransformRotateZ>) {
                        SkM44 rotate;
                        rotate.setRotateUnit({ 0.0f, 0.0f, 1.0f }, toNativeStyleFloat("transform.rotateZ", op.rotateZ));
                        matrix.preConcat(rotate);
                        hasTransform = true;
                    } else if constexpr (std::is_same_v<T, TransformScale>) {
                        const float s = toNativeStyleFloat("transform.scale", op.scale);
                        matrix.preScale(s, s, 1.0f);
                        hasTransform = true;
                    } else if constexpr (std::is_same_v<T, TransformScaleX>) {
                        matrix.preScale(toNativeStyleFloat("transform.scaleX", op.scaleX), 1.0f, 1.0f);
                        hasTransform = true;
                    } else if constexpr (std::is_same_v<T, TransformScaleY>) {
                        matrix.preScale(1.0f, toNativeStyleFloat("transform.scaleY", op.scaleY), 1.0f);
                        hasTransform = true;
                    } else if constexpr (std::is_same_v<T, TransformTranslateX>) {
                        matrix.preTranslate(toNativeStyleFloat("transform.translateX", op.translateX), 0.0f, 0.0f);
                        hasTransform = true;
                    } else if constexpr (std::is_same_v<T, TransformTranslateY>) {
                        matrix.preTranslate(0.0f, toNativeStyleFloat("transform.translateY", op.translateY), 0.0f);
                        hasTransform = true;
                    } else if constexpr (std::is_same_v<T, TransformSkewX>) {
                        const float tangent = toNativeStyleFloat("transform.skewX", std::tan(op.skewX));
                        SkM44 skew(1.0f, 0.0f, 0.0f, 0.0f,
                            tangent, 1.0f, 0.0f, 0.0f,
                            0.0f, 0.0f, 1.0f, 0.0f,
                            0.0f, 0.0f, 0.0f, 1.0f);
                        matrix.preConcat(skew);
                        hasTransform = true;
                    } else if constexpr (std::is_same_v<T, TransformSkewY>) {
                        const float tangent = toNativeStyleFloat("transform.skewY", std::tan(op.skewY));
                        SkM44 skew(1.0f, tangent, 0.0f, 0.0f,
                            0.0f, 1.0f, 0.0f, 0.0f,
                            0.0f, 0.0f, 1.0f, 0.0f,
                            0.0f, 0.0f, 0.0f, 1.0f);
                        matrix.preConcat(skew);
                        hasTransform = true;
                    } else {
                        static_assert(alwaysFalse<T>, "Unsupported transform operation");
                    }
                },
                transform);
        }

        if (hasTransform) {
            _matrix = std::make_shared<SkMatrix>(matrix.asM33());
        } else {
            applyMatrixStyle();
        }
    } else {
        applyMatrixStyle();
    }
}

void YogaNode::insertChild(const std::shared_ptr<HybridYogaNodeSpec>& child, const std::optional<std::variant<double, std::shared_ptr<HybridYogaNodeSpec>>>& index)
{
    std::lock_guard<std::recursive_mutex> lock(yogaTreeMutex());
    if (!child) {
        return; // No child to insert
    }

    auto yogaNode = std::dynamic_pointer_cast<YogaNode>(child);

    if (!yogaNode) {
        throw std::runtime_error("Child is not a YogaNode");
    }

    if (_node == nullptr || yogaNode->_node == nullptr) {
        throw std::runtime_error("Cannot insert a disposed YogaNode");
    }

    if (isAncestorOrSelf(*yogaNode, *this)) {
        throw std::runtime_error("Cannot insert a YogaNode into itself or one of its descendants");
    }

    auto parentSelf = sharedYogaNodeForInsert(*this);

    enum class InsertTargetKind {
        Append,
        NumericIndex,
        BeforeNode,
    };

    InsertTargetKind targetKind = InsertTargetKind::Append;
    size_t requestedIndex = 0;
    std::shared_ptr<YogaNode> beforeYogaNode;

    if (index.has_value()) {
        if (std::holds_alternative<double>(index.value())) {
            double idx = std::get<double>(index.value());
            if (idx < 0 || idx >= YGNodeGetChildCount(_node)) {
                throw std::out_of_range("Index out of range for YogaNode children");
            }
            requestedIndex = static_cast<size_t>(idx);
            targetKind = InsertTargetKind::NumericIndex;
        } else if (std::holds_alternative<std::shared_ptr<margelo::nitro::RNSkiaYoga::HybridYogaNodeSpec>>(index.value())) {
            auto indexNode = std::get<std::shared_ptr<margelo::nitro::RNSkiaYoga::HybridYogaNodeSpec>>(index.value());
            auto indexYogaNode = std::dynamic_pointer_cast<YogaNode>(indexNode);
            if (!indexYogaNode) {
                throw std::runtime_error("Index is not a YogaNode");
            }

            if (!findChildIndex(*this, *indexYogaNode).has_value()) {
                throw std::runtime_error("Index node is not a child of this YogaNode");
            }

            if (indexYogaNode.get() == yogaNode.get()) {
                return;
            }

            beforeYogaNode = indexYogaNode;
            targetKind = InsertTargetKind::BeforeNode;
        } else {
            throw std::runtime_error("Invalid index type for YogaNode insertion");
        }
    }

    if (auto oldParent = yogaNode->_parent.lock()) {
        detachChildFromParent(*oldParent, yogaNode);
    } else if (YGNodeGetParent(yogaNode->_node) != nullptr) {
        throw std::runtime_error("Cannot insert YogaNode because its Yoga owner has no live YogaNode parent link");
    }

    size_t insertIndex = _children.size();
    switch (targetKind) {
    case InsertTargetKind::Append:
        insertIndex = _children.size();
        break;
    case InsertTargetKind::NumericIndex:
        if (requestedIndex > _children.size()) {
            throw std::out_of_range("Index out of range for YogaNode children after reparenting");
        }
        insertIndex = requestedIndex;
        break;
    case InsertTargetKind::BeforeNode: {
        const auto beforeIndex = findChildIndex(*this, *beforeYogaNode);
        if (!beforeIndex.has_value()) {
            throw std::runtime_error("Index node is not a child of this YogaNode after reparenting");
        }
        insertIndex = *beforeIndex;
        break;
    }
    }

    _children.insert(_children.begin() + static_cast<std::ptrdiff_t>(insertIndex), yogaNode);
    try {
        YGNodeInsertChild(_node, yogaNode->_node, insertIndex);
    } catch (...) {
        _children.erase(_children.begin() + static_cast<std::ptrdiff_t>(insertIndex));
        if (YGNodeGetParent(yogaNode->_node) == _node) {
            YGNodeRemoveChild(_node, yogaNode->_node);
        }
        throw;
    }

    yogaNode->_parent = parentSelf;
    adjustInteractiveDescendantCount(yogaNode->_interactiveDescendantCount);
    invalidateLayout();
}

// void removeChild(const std::shared_ptr<HybridYogaNodeSpec>& child) override;
void YogaNode::removeChild(const std::shared_ptr<HybridYogaNodeSpec>& c)
{
    std::lock_guard<std::recursive_mutex> lock(yogaTreeMutex());
    if (!c) {
        return;
    }

    auto child = std::dynamic_pointer_cast<YogaNode>(c);
    if (!child) {
        throw std::runtime_error("Child is not a YogaNode");
    }

    detachChildFromParent(*this, child);
}

void YogaNode::removeAllChildren()
{
    std::lock_guard<std::recursive_mutex> lock(yogaTreeMutex());
    detachAllChildren(*this, true);
}

void YogaNode::setCommand(NodeCommand command)
{
    std::lock_guard<std::recursive_mutex> lock(yogaTreeMutex());
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
    return withJsiError(runtime, "YogaNode.draw()", [&]() -> jsi::Value {
        std::lock_guard<std::recursive_mutex> lock(yogaTreeMutex());
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
        return jsi::Object::createFromHostObject(runtime, std::make_shared<RNSkia::JsiSkPicture>(GetPlatformContext(), picture));
    });
}

void YogaNode::renderToContext(RNSkia::DrawingCtx& ctx)
{
    std::lock_guard<std::recursive_mutex> lock(yogaTreeMutex());

    if (!_command) {
        return;
    }

    drawInternal(ctx);
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

    auto paint = _paint;
    // Command-specific text color is only used when the current style snapshot
    // did not supply its own paint color. Style still wins when it is explicit.
    if (!_style.backgroundColor.has_value()) {
        if (const auto fallbackColor = _command->fallbackPaintColor()) {
            if (_style.opacity.has_value()) {
                paint.setColor(SkColorSetA(*fallbackColor, SkColorGetA(paint.getColor())));
            } else {
                paint.setColor(*fallbackColor);
            }
        }
    }

    auto maskFilter = ctx.getPaint().refMaskFilter();
    paint.setMaskFilter(maskFilter);

    ctx.pushPaint(paint);

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
    return withJsiError(runtime, "YogaNode.getChildren()", [&]() -> jsi::Value {
        (void)thisArg;
        (void)args;
        (void)count;
        jsi::Array arr = jsi::Array(runtime, _children.size());
        for (size_t i = 0; i < _children.size(); ++i) {
            auto obj = _children[i]->toObject(runtime);
            arr.setValueAtIndex(runtime, i, obj);
        }
        return arr;
    });
}

void YogaNode::computeLayout(std::optional<double> width, std::optional<double> height)
{
    std::lock_guard<std::recursive_mutex> lock(yogaTreeMutex());
    float w = width.has_value() ? toFiniteYogaNodeMethodFloat(width.value(), "computeLayout.width") : YGUndefined;
    float h = height.has_value() ? toFiniteYogaNodeMethodFloat(height.value(), "computeLayout.height") : YGUndefined;

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
    if (auto parent = _parent.lock()) {
        parent->invalidateLayout();
    }
}

void YogaNode::invalidateRasterCache()
{
    _rasterCacheDirty = true;
    _rasterCache.reset();

    if (auto parent = _parent.lock()) {
        parent->invalidateRasterCache();
    }
}

void YogaNode::adjustInteractiveDescendantCount(int delta)
{
    if (delta == 0) {
        return;
    }

    _interactiveDescendantCount += delta;

    if (auto parent = _parent.lock()) {
        parent->adjustInteractiveDescendantCount(delta);
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
    return withJsiError(runtime, "YogaNode.hitTest(x, y)", [&]() -> jsi::Value {
        std::lock_guard<std::recursive_mutex> lock(yogaTreeMutex());
        (void)thisArg;

        if (count < 2 || !args[0].isNumber() || !args[1].isNumber()) {
            throw jsi::JSError(runtime, "YogaNode.hitTest(x, y) expects numeric x and y arguments.");
        }

        const auto x = toFiniteYogaNodeMethodFloat(args[0].asNumber(), "hitTest.x");
        const auto y = toFiniteYogaNodeMethodFloat(args[1].asNumber(), "hitTest.y");
        return jsi::Value(hitTestTagAt(x, y));
    });
}

jsi::Value YogaNode::setInteractionConfig(jsi::Runtime& runtime, const jsi::Value& thisArg, const jsi::Value* args, size_t count)
{
    return withJsiError(runtime, "YogaNode.setInteractionConfig(config)", [&]() -> jsi::Value {
        std::lock_guard<std::recursive_mutex> lock(yogaTreeMutex());
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
                const auto inset = toFiniteHitSlopFloat(hitSlopValue.asNumber(), "hitSlop");
                hitSlop.top = inset;
                hitSlop.right = inset;
                hitSlop.bottom = inset;
                hitSlop.left = inset;
            } else if (hitSlopValue.isObject()) {
                const auto hitSlopObject = hitSlopValue.asObject(runtime);
                const auto left = getHitSlopNumericProperty(runtime, hitSlopObject, "left", "hitSlop.left", 0.0f);
                const auto right = getHitSlopNumericProperty(runtime, hitSlopObject, "right", "hitSlop.right", 0.0f);
                const auto top = getHitSlopNumericProperty(runtime, hitSlopObject, "top", "hitSlop.top", 0.0f);
                const auto bottom = getHitSlopNumericProperty(runtime, hitSlopObject, "bottom", "hitSlop.bottom", 0.0f);

                const auto horizontal = getHitSlopNumericProperty(runtime, hitSlopObject, "horizontal", "hitSlop.horizontal", 0.0f);
                const auto vertical = getHitSlopNumericProperty(runtime, hitSlopObject, "vertical", "hitSlop.vertical", 0.0f);
                hitSlop.left = addHitSlopValues(left, horizontal, "hitSlop.left");
                hitSlop.right = addHitSlopValues(right, horizontal, "hitSlop.right");
                hitSlop.top = addHitSlopValues(top, vertical, "hitSlop.top");
                hitSlop.bottom = addHitSlopValues(bottom, vertical, "hitSlop.bottom");
            }
        }

        const auto preciseHit =
            config.hasProperty(runtime, "preciseHit") &&
            config.getProperty(runtime, "preciseHit").isBool() &&
            config.getProperty(runtime, "preciseHit").getBool();

        double nextEventTag = 0.0;
        if (config.hasProperty(runtime, "eventTag")) {
            const auto value = config.getProperty(runtime, "eventTag");
            if (!value.isNumber()) {
                throwInvalidEventTag();
            }
            nextEventTag = toValidEventTag(value.asNumber());
        }

        _pointerEvents = pointerEvents;
        _hitSlop = hitSlop;
        _preciseHit = preciseHit;
        _eventTag = nextEventTag;
        updateSelfInteractionState(_eventTag > 0.0);
        return jsi::Value::undefined();
    });
}

void BlurMaskFilterCmd::updateProps(const BlurMaskFilterCommandData& props)
{
    _props = BlurMaskFilterProps {};
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
    this->props.font = *sDefaultFont;

    if (props.font.has_value()) {
        this->props.font = props.font.value();
    }

    const auto textStyle = props.textStyle.value_or(skia::textlayout::TextStyle());
    auto font = this->props.font;
    if (font.has_value() && textStyle.getFontSize() > 0.0f) {
        font->setSize(textStyle.getFontSize());
        this->props.font = font;
    }

    _fallbackPaintColor = textStyle.getColor();
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
    this->props.mode = props.pointMode.value_or(SkCanvas::PointMode::kPoints_PointMode);
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

    auto context = GetPlatformContext();
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
    auto context = GetPlatformContext();
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
