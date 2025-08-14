#pragma once

#include "HybridSkiaYogaSpec.hpp"
#include "HybridYogaNodeSpec.hpp"
#include <jsi/jsi.h>
#include <yoga/Yoga.h>
#include <react-native-skia/cpp/skia/include/private/base/SkTypeTraits.h>
#include <react-native-skia/cpp/api/JsiSkApi.h>
#include <react-native-skia/cpp/api/recorder/Command.h>
#include <memory>

namespace margelo::nitro::RNSkiaYoga {

using namespace facebook;

class YogaNode : public HybridYogaNodeSpec {
public:
  // This default constructor is required for autolinking in RNSkiaYogaAutolinking.mm
  YogaNode();
  ~YogaNode();
  void setStyle(const NodeStyle& style) override;
  void setType(const NodeType type) override;
  void insertChild(const std::shared_ptr<margelo::nitro::RNSkiaYoga::HybridYogaNodeSpec>& child, const std::optional<std::variant<double, std::shared_ptr<margelo::nitro::RNSkiaYoga::HybridYogaNodeSpec>>>& index) override;
  void removeChild(const std::shared_ptr<margelo::nitro::RNSkiaYoga::HybridYogaNodeSpec>& child) override;
  YogaNodeLayout getComputedLayout() override;

  void removeAllChildren() override;
  jsi::Value setProps(jsi::Runtime& runtime, const jsi::Value& thisArg, const jsi::Value* args, size_t count);

  jsi::Value draw(jsi::Runtime& runtime, const jsi::Value& thisArg, const jsi::Value* args, size_t count);

private:
  YGNodeRef _node;
  NodeType _type;
  std::unique_ptr<RNSkia::Command> _command;

  void loadHybridMethods() override {
    // register base protoype
    HybridYogaNodeSpec::loadHybridMethods();
    // register all methods we override here
    registerHybrids(this, [](Prototype& prototype) {
      prototype.registerRawHybridMethod("setProps", 1, &YogaNode::setProps);
      prototype.registerRawHybridMethod("draw", 1, &YogaNode::draw);
    });
  }
};

}; // namespace margelo::nitro::RNSkiaYoga

