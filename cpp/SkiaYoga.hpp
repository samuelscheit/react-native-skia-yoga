#pragma once

#include "HybridSkiaYogaSpec.hpp"
#include <memory>
#include <string>

// Forward declare Skia platform context (base) in global namespace to avoid pulling platform-specific headers here
namespace RNSkia { class RNSkPlatformContext; }

namespace margelo::nitro::RNSkiaYoga {

class SkiaYoga : public HybridSkiaYogaSpec {
public:
  // This default constructor is required for autolinking in RNSkiaYogaAutolinking.mm
  SkiaYoga();
  ~SkiaYoga();

  // Static shared platform context (base type). On Apple we store an RNSkApplePlatformContext.
  static std::shared_ptr<RNSkia::RNSkPlatformContext> platformContext;
  static inline std::shared_ptr<RNSkia::RNSkPlatformContext> getPlatformContext() { return platformContext; }

  void attachViewRoot(double nativeId, const std::shared_ptr<HybridYogaNodeSpec>& root) override;
  void detachViewRoot(double nativeId) override;
  void requestViewRender(double nativeId) override;
  void setViewAnimating(double nativeId, bool animating) override;
  std::string consumeViewProfileSample(double nativeId) override;

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
