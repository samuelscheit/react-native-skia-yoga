#pragma once

// Ensure JSIConverter specializations are visible before Nitro-generated headers
#include "JSIConverter+SkMatrix.hpp"
#include "JSIConverter+SkPaint.hpp"
#include "JSIConverter+SkFont.hpp"
#include "JSIConverter+SkImage.hpp"
#include "JSIConverter+SkPath.hpp"
#include "JSIConverter+SkRect.hpp"
#include "JSIConverter+SkRRect.hpp"

#include "HybridSkiaYogaSpec.hpp"
#include "HybridYogaNodeSpec.hpp"
#include "SkiaYoga.hpp"
#include <jsi/jsi.h>
#include <array>
#include <memory>
#include <react-native-skia/cpp/api/JsiSkApi.h>
#include <react-native-skia/cpp/api/JsiSkParagraph.h>
#include <react-native-skia/cpp/api/recorder/Command.h>
#include <react-native-skia/cpp/api/recorder/Drawings.h>
#include <react-native-skia/cpp/skia/include/private/base/SkTypeTraits.h>
#include <yoga/Yoga.h>

namespace margelo::nitro::RNSkiaYoga {
class YogaNode;
}

namespace margelo::nitro::RNSkiaYoga {

using namespace facebook;

class YogaNodeCommand {
public:
    virtual ~YogaNodeCommand() = default;

    // reine virtuelle Schnittstelle
    virtual void setLayout(const YogaNodeLayout& layout) = 0;
    virtual void draw(RNSkia::DrawingCtx* ctx) = 0;

protected:
    explicit YogaNodeCommand(YogaNode* node)
        : node(node)
    {
    }

    YogaNode* node;
};

class YogaNode : public HybridYogaNodeSpec {
public:
    // This default constructor is required for autolinking in RNSkiaYogaAutolinking.mm
    YogaNode();
    ~YogaNode();
    void setStyle(const NodeStyle& style) override;
    void setType(NodeType type) override;
    void insertChild(const std::shared_ptr<HybridYogaNodeSpec>& child, const std::optional<std::variant<double, std::shared_ptr<HybridYogaNodeSpec>>>& index) override;
    void removeChild(const std::shared_ptr<HybridYogaNodeSpec>& child) override;
    std::vector<std::shared_ptr<HybridYogaNodeSpec>> getChildren() override;
    void setChildren(const std::vector<std::shared_ptr<HybridYogaNodeSpec>>& children) override;

    void computeLayout(std::optional<double> width, std::optional<double> height) override;
    void recursiveSetLayout();
    YogaNodeLayout getLayout() override;
    void setLayout(const YogaNodeLayout& layout) override;

    void removeAllChildren() override;

    jsi::Value setType(jsi::Runtime& runtime, const jsi::Value& thisArg, const jsi::Value* args, size_t count);
    jsi::Value setProps(jsi::Runtime& runtime, const jsi::Value& thisArg, const jsi::Value* args, size_t count);
    jsi::Value draw(jsi::Runtime& runtime, const jsi::Value& thisArg, const jsi::Value* args, size_t count);
    void drawInternal(RNSkia::DrawingCtx& ctx);

    std::string getName() const { return "YogaNode"; }

    YGNodeRef _node;
    NodeType _type;
    YogaNodeLayout _layout;
    std::unique_ptr<YogaNodeCommand> _command;
    std::vector<std::shared_ptr<YogaNode>> _children;
    NodeStyle _style;
    SkPaint _paint;
    std::optional<SkPath> _clipPath;
    std::optional<SkRRect> _clipRRect;
    std::optional<std::array<SkVector, 4>> _clipRRectRadii;
    std::optional<SkRect> _clipRect;
    std::optional<SkM44> _transform;
    std::optional<SkMatrix> _matrix;

    void loadHybridMethods() override
    {
        // register base protoype
        HybridYogaNodeSpec::loadHybridMethods();
        // register all methods we override here
        registerHybrids(this, [](Prototype& prototype) {
            prototype.registerRawHybridMethod("setProps", 1, &YogaNode::setProps);
            prototype.registerRawHybridMethod("draw", 1, &YogaNode::draw);
            prototype.registerRawHybridMethod("setType", 1, &YogaNode::setType);

        });
    }
};

class RectCmd : public RNSkia::RectCmd, public YogaNodeCommand {
public:
    RectCmd(YogaNode* node, jsi::Runtime& runtime, const jsi::Object& props, RNSkia::Variables& variables)
        : RNSkia::RectCmd(runtime, props, variables)
        , YogaNodeCommand(node)
    {
    }

    void setLayout(const YogaNodeLayout& layout) override
    {
        this->props.rect = SkRect::MakeXYWH(layout.left, layout.top, layout.width, layout.height);
    }

    void draw(RNSkia::DrawingCtx* ctx) override { RNSkia::RectCmd::draw(ctx); }
};

class RRectCmd : public RNSkia::RRectCmd, public YogaNodeCommand {
public:
    RRectCmd(YogaNode* node, jsi::Runtime& runtime, const jsi::Object& props, RNSkia::Variables& variables)
        : RNSkia::RRectCmd(runtime, props, variables)
        , YogaNodeCommand(node)
    {
    }  

    void setLayout(const YogaNodeLayout& layout) override
    {
        auto radius = this->props.r.value_or(RNSkia::Radius{0, 0});
        this->props.rect = SkRRect::MakeRectXY(SkRect::MakeXYWH(layout.left, layout.top, layout.width, layout.height), radius.rX, radius.rY);
    }

    void draw(RNSkia::DrawingCtx* ctx) override { RNSkia::RRectCmd::draw(ctx); }
};

class TextCmd : public RNSkia::TextCmd, public YogaNodeCommand {
public:
    TextCmd(YogaNode* node, jsi::Runtime& runtime, const jsi::Object& props, RNSkia::Variables& variables)
        : RNSkia::TextCmd(runtime, props, variables)
        , YogaNodeCommand(node)
    {
    }

    void setLayout(const YogaNodeLayout& layout) override
    {
        this->props.x = layout.left;
        this->props.y = layout.top;
    }

    void draw(RNSkia::DrawingCtx* ctx) override { RNSkia::TextCmd::draw(ctx); }
};

class ImageCmd : public RNSkia::ImageCmd, public YogaNodeCommand {
public:
    ImageCmd(YogaNode* node, jsi::Runtime& runtime, const jsi::Object& props, RNSkia::Variables& variables)
        : RNSkia::ImageCmd(runtime, props, variables)
        , YogaNodeCommand(node)
    {
    }

    void setLayout(const YogaNodeLayout& layout) override
    {
        this->props.x = static_cast<float>(layout.left);
        this->props.y = static_cast<float>(layout.top);
        this->props.width = static_cast<float>(layout.width);
        this->props.height = static_cast<float>(layout.height);
        this->props.rect = SkRect::MakeXYWH(layout.left, layout.top, layout.width, layout.height);
    }

    void draw(RNSkia::DrawingCtx* ctx) override { RNSkia::ImageCmd::draw(ctx); }
};

class PathCmd : public RNSkia::PathCmd, public YogaNodeCommand {
public:
    PathCmd(YogaNode* node, jsi::Runtime& runtime, const jsi::Object& props, RNSkia::Variables& variables)
        : RNSkia::PathCmd(runtime, props, variables)
        , YogaNodeCommand(node)
        , _basePath(this->props.path)
    {
    }

    void setLayout(const YogaNodeLayout& layout) override
    {
        this->props.path = _basePath;
        this->props.path.offset(static_cast<float>(layout.left), static_cast<float>(layout.top));
    }

    void setBasePath(const SkPath& path) { _basePath = path; }

    void draw(RNSkia::DrawingCtx* ctx) override { RNSkia::PathCmd::draw(ctx); }

private:
    SkPath _basePath;
};

class ParagraphCmd : public RNSkia::ParagraphCmd, public YogaNodeCommand {
public:
    ParagraphCmd(YogaNode* node, jsi::Runtime& runtime, const jsi::Object& props, RNSkia::Variables& variables)
        : RNSkia::ParagraphCmd(runtime, props, variables)
        , YogaNodeCommand(node)
    {
    }

    void setLayout(const YogaNodeLayout& layout) override
    {
        this->props.x = layout.left;
        this->props.y = layout.top;
        this->props.width = layout.width;
    }

    void draw(RNSkia::DrawingCtx* ctx) override { RNSkia::ParagraphCmd::draw(ctx); }


    static YGSize measureFunc(YGNodeConstRef node, float width, YGMeasureMode widthMode, float height, YGMeasureMode heightMode) {
        auto paragraph = static_cast<YogaNode *>(YGNodeGetContext(node));
        
        auto cmd = static_cast<ParagraphCmd *>(paragraph->_command.get());

        auto skParagraph = cmd->props.paragraph->getObject();
        if (width <= 0 || widthMode == YGMeasureModeUndefined) {
            width = 20000000.0f; // very large width
        }

        skParagraph->layout(width);
        auto sz = skParagraph->getHeight();
        return YGSize{width, sz};

    }
};

} // namespace margelo::nitro::RNSkiaYoga
