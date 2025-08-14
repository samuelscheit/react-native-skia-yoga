

// Implementation for RNSkiaModule bridging Skia Apple platform context to React Native
#import "SkiaYogaModule.h"
#import <React/RCTBridge+Private.h>
#import <ReactCommon/RCTTurboModule.h>
// Include full definition of RNSkApplePlatformContext to avoid incomplete type
#import <react-native-skia/apple/RNSkApplePlatformContext.h>
#import "../cpp/SkiaYoga.hpp"

@implementation SkiaYogaModule {
  std::shared_ptr<RNSkia::RNSkApplePlatformContext> _skiaManager;
  std::shared_ptr<facebook::react::CallInvoker> _jsInvoker;
}

RCT_EXPORT_MODULE(SkiaYogaModule)
@synthesize bridge = _bridge;

#pragma Accessorsp

- (RNSkia::RNSkApplePlatformContext *)manager {
  return _skiaManager.get();
}

#pragma Setup and invalidation

+ (BOOL)requiresMainQueueSetup {
  return YES;
}

- (void)invalidate {
  _skiaManager.reset();
  _jsInvoker.reset();
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(install) {
  // Idempotent init
  if (_skiaManager) {
    return @true;
  }
  RCTCxxBridge *cxxBridge = (RCTCxxBridge *)self.bridge;
  if (!_jsInvoker && cxxBridge != nil) {
    _jsInvoker = cxxBridge.jsCallInvoker;
  }
  // Guard: require bridge & invoker
  if (!self.bridge || !_jsInvoker) {
    return @false;
  }
  _skiaManager = std::make_shared<RNSkia::RNSkApplePlatformContext>(self.bridge, _jsInvoker);
  // Store in global static so C++ layer (SkiaYoga) can access the platform context.
  margelo::nitro::RNSkiaYoga::SkiaYoga::platformContext = _skiaManager;
  return @true;
}

@end

