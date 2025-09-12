

// Implementation for RNSkiaModule bridging Skia Apple platform context to React Native
#import "SkiaYogaModule.h"
#import <React/RCTBridge+Private.h>
#import <ReactCommon/RCTTurboModule.h>
#import <jsi/jsi.h>
#include "PlatformContextFactory.h"
#include "RuntimeAwareCache.h"

namespace jsi = facebook::jsi;

@implementation SkiaYogaModule {
  // Raw pointer view; lifetime held by global shared_ptr inside C++ layer (SkiaYoga::platformContext)
  std::shared_ptr<facebook::react::CallInvoker> _jsInvoker;
}

RCT_EXPORT_MODULE(SkiaYogaModule)
@synthesize bridge = _bridge;

#pragma Accessorsp

#pragma Setup and invalidation

+ (BOOL)requiresMainQueueSetup {
  return YES;
}

- (void)invalidate {
  SkiaYogaDestroyPlatformContext();
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(install) {
  RCTCxxBridge *cxxBridge = (RCTCxxBridge *)self.bridge;
  if (!_jsInvoker && cxxBridge != nil) {
    _jsInvoker = cxxBridge.jsCallInvoker;
  }
  // Guard: require bridge & invoker
  if (!self.bridge || !_jsInvoker) {
    return @false;
  }

  auto jsiRuntime = (jsi::Runtime*) cxxBridge.runtime;
    if (jsiRuntime == nil) {
    return @false;
  }
  auto& runtime = *jsiRuntime;


  RNJsi::BaseRuntimeAwareCache::setMainJsRuntime(jsiRuntime);
  SkiaYogaCreatePlatformContext((__bridge void*)self.bridge, (void*)&_jsInvoker);
  return @true;
}

@end

