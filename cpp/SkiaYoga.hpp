#pragma once

#include "SkiaGlue.hpp"
#include "HybridSkiaYogaSpec.hpp"
#include "HybridYogaNodeSpec.hpp"
#include <jsi/jsi.h>
#include <yoga/Yoga.h>
#include <memory>

// Forward declare Skia platform context (base) in global namespace to avoid pulling platform-specific headers here
namespace RNSkia { class RNSkPlatformContext; }

namespace margelo::nitro::RNSkiaYoga {

using namespace facebook;

class SkiaYoga : public HybridSkiaYogaSpec {
public:
  // This default constructor is required for autolinking in RNSkiaYogaAutolinking.mm
  SkiaYoga();
  ~SkiaYoga();

  // Static shared platform context (base type). On Apple we store an RNSkApplePlatformContext.
  static std::shared_ptr<RNSkia::RNSkPlatformContext> platformContext;
  static inline std::shared_ptr<RNSkia::RNSkPlatformContext> getPlatformContext() { return platformContext; }

  void loadHybridMethods() override
  {
      // register base protoype
      HybridSkiaYogaSpec::loadHybridMethods();
      // register all methods we override here
      registerHybrids(this, [](Prototype& prototype) {
      });
  }
 
};

}; // namespace margelo::nitro::RNSkiaYoga
