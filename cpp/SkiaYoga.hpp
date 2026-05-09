#pragma once

#include "HybridSkiaYogaSpec.hpp"
#include <memory>
#include <string>

namespace margelo::nitro::RNSkiaYoga {

class SkiaYoga : public HybridSkiaYogaSpec {
public:
  // This default constructor is required for autolinking in RNSkiaYogaAutolinking.mm
  SkiaYoga();
  ~SkiaYoga();

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
