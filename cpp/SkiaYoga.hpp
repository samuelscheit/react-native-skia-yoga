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

class SkiaYoga : public HybridSkiaYogaSpec {
public:
  // This default constructor is required for autolinking in RNSkiaYogaAutolinking.mm
  SkiaYoga();
  ~SkiaYoga();
  double addNumbers(double a, double b) override;
 
};

}; // namespace margelo::nitro::RNSkiaYoga

