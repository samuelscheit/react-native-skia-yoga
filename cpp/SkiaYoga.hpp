#pragma once

#include "HybridSkiaYogaSpec.hpp"
#include "HybridYogaNodeSpec.hpp"
#include <jsi/jsi.h>
#include <yoga/Yoga.h>

namespace margelo::nitro::RNSkiaYoga {

using namespace facebook;

class SkiaYoga : public HybridSkiaYogaSpec {
public:
  SkiaYoga() : HybridObject(TAG) {}
  double addNumbers(double a, double b) override;
 
};

class YogaNode : public HybridYogaNodeSpec {
public:
  YogaNode();
  ~YogaNode();
  void setStyle(const NodeStyle& style) override;

private:
  YGNodeRef _node;
};

}; // namespace margelo::nitro::test
