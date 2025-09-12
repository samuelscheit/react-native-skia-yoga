#pragma once

#include "HybridSkiaYogaSpec.hpp"
#include "HybridYogaNodeSpec.hpp"
#include "SkiaYoga.hpp"
#include <jsi/jsi.h>
#include <memory>
#include <react-native-skia/cpp/api/JsiSkApi.h>
#include <react-native-skia/cpp/api/JsiSkParagraph.h>
#include <react-native-skia/cpp/api/recorder/Command.h>
#include <react-native-skia/cpp/api/recorder/Drawings.h>
#include <react-native-skia/cpp/skia/include/private/base/SkTypeTraits.h>
#include <yoga/Yoga.h>

namespace margelo::nitro {
template <>
struct JSIConverter<margelo::nitro::RNSkiaYoga::YogaNode> {
    static margelo::nitro::RNSkiaYoga::YogaNode fromJSI(jsi::Runtime& runtime,
        const jsi::Value& arg)
    {
        jsi::Object obj = arg.asObject(runtime);
        return obj.getNativeState<margelo::nitro::RNSkiaYoga::YogaNode>(runtime);
    }
    static jsi::Value toJSI(jsi::Runtime& runtime,
        margelo::nitro::RNSkiaYoga::YogaNode arg)
    {
        jsi::Object obj(runtime);
        obj.setNativeState(runtime, arg);
        return obj;
    }
    static bool canConvert(jsi::Runtime& runtime, const jsi::Value& value)
    {
        if (!value.isObject())
            return false;
        jsi::Object obj = value.getObject(runtime);
        return obj.hasNativeState<margelo::nitro::RNSkiaYoga::YogaNode>(runtime);
    }
};
}

namespace margelo::nitro::RNSkiaYoga {

using namespace facebook;

class YogaNodeCommand {
public:
    virtual ~YogaNodeCommand() = default;

    // reine virtuelle Schnittstelle
    virtual void setLayout(const YogaNodeLayout& layout) = 0;
    virtual void draw(RNSkia::DrawingCtx* ctx) = 0;
};

class YogaNode : public HybridYogaNodeSpec {
public:
    // This default constructor is required for autolinking in RNSkiaYogaAutolinking.mm
    YogaNode();
    ~YogaNode();
    void setStyle(const NodeStyle& style) override;
    void setType(const NodeType type) override;
    void insertChild(const std::shared_ptr<margelo::nitro::RNSkiaYoga::YogaNode>& child, const std::optional<std::variant<double, std::shared_ptr<margelo::nitro::RNSkiaYoga::YogaNode>>>& index) override;
    void removeChild(const std::shared_ptr<margelo::nitro::RNSkiaYoga::YogaNode>& child) override;
    std::vector<std::shared_ptr<margelo::nitro::RNSkiaYoga::YogaNode>> getChildren() override;
    void setChildren(const std::vector<std::shared_ptr<margelo::nitro::RNSkiaYoga::YogaNode>>& children) override;

    YogaNodeLayout getComputedLayout() override;

    void removeAllChildren() override;
    jsi::Value setProps(jsi::Runtime& runtime, const jsi::Value& thisArg, const jsi::Value* args, size_t count);

    jsi::Value draw(jsi::Runtime& runtime, const jsi::Value& thisArg, const jsi::Value* args, size_t count);

    std::string getName() const { return "YogaNode"; }

private:
    YGNodeRef _node;
    NodeType _type;
    std::unique_ptr<YogaNodeCommand> _command;
    std::vector<std::shared_ptr<YogaNode>> _children;

    void loadHybridMethods() override
    {
        // register base protoype
        HybridYogaNodeSpec::loadHybridMethods();
        // register all methods we override here
        registerHybrids(this, [](Prototype& prototype) {
            prototype.registerRawHybridMethod("setProps", 1, &YogaNode::setProps);
            prototype.registerRawHybridMethod("draw", 1, &YogaNode::draw);
        });
    }
};

class RectCmd : public RNSkia::RectCmd, public YogaNodeCommand {
public:
    RectCmd(jsi::Runtime& runtime, const jsi::Object& props, RNSkia::Variables& variables)
        : RNSkia::RectCmd(runtime, props, variables)
    {
    }

    void setLayout(const YogaNodeLayout& layout) override
    {
        this->props.rect = SkRect::MakeXYWH(layout.left, layout.top, layout.width, layout.height);
    }

    void draw(RNSkia::DrawingCtx* ctx) override
    {
        RNSkia::RectCmd::draw(ctx);
    }
};

class TextCmd : public RNSkia::TextCmd, public YogaNodeCommand {
public:
    TextCmd(jsi::Runtime& runtime, const jsi::Object& props, RNSkia::Variables& variables)
        : RNSkia::TextCmd(runtime, props, variables)
    {
    }

    void setLayout(const YogaNodeLayout& layout) override
    {
        this->props.x = layout.left;
        this->props.y = layout.top;
    }

    void draw(RNSkia::DrawingCtx* ctx) override
    {
        RNSkia::TextCmd::draw(ctx);
    }
};

class ParagraphCmd : public RNSkia::ParagraphCmd, public YogaNodeCommand {
public:
    ParagraphCmd(jsi::Runtime& runtime, const jsi::Object& props, RNSkia::Variables& variables)
        : RNSkia::ParagraphCmd(runtime, props, variables)
    {
    }

    void setLayout(const YogaNodeLayout& layout) override
    {
        this->props.x = layout.left;
        this->props.y = layout.top;
        this->props.width = layout.width;
    }

    void draw(RNSkia::DrawingCtx* ctx) override
    {
        RNSkia::ParagraphCmd::draw(ctx);
    }
};

} // namespace margelo::nitro::RNSkiaYoga
