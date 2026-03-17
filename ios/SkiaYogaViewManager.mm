#include "SkiaYogaViewManager.h"

#include <React/RCTBridge+Private.h>

#include "RNSkAppleView.h"
#include "RNSkPlatformContext.h"
#include "RNSkiaModule.h"
#include "RNSkYogaView.hpp"
#include "SkiaManager.h"
#include "SkiaUIView.h"
#include "SkiaYogaView.h"

#if RCT_NEW_ARCH_ENABLED
#import <React/RCTLegacyViewManagerInteropComponentView.h>
#endif

#if RCT_NEW_ARCH_ENABLED
__attribute__((constructor)) static void
SkiaYogaViewManagerRegisterLegacyInterop(void)
{
  [RCTLegacyViewManagerInteropComponentView supportLegacyViewManagerWithName:@"SkiaYogaView"];
}
#endif

@implementation SkiaYogaViewManager

RCT_EXPORT_MODULE(SkiaYogaView)

- (SkiaManager *)skiaManager {
  auto bridge = self.bridge;
  RCTAssert(bridge, @"Bridge must not be nil.");
  auto skiaModule = (RNSkiaModule *)[bridge moduleForName:@"RNSkiaModule"];
  return [skiaModule manager];
}

RCT_CUSTOM_VIEW_PROPERTY(nativeID, NSNumber, SkiaUIView) {
  int nativeId = [[RCTConvert NSString:json] intValue];
  [(SkiaUIView *)view setNativeId:nativeId];
}

RCT_CUSTOM_VIEW_PROPERTY(debug, BOOL, SkiaUIView) {
  bool debug = json != NULL ? [RCTConvert BOOL:json] : false;
  [(SkiaUIView *)view setDebugMode:debug];
}

RCT_CUSTOM_VIEW_PROPERTY(opaque, BOOL, SkiaUIView) {
  bool opaque = json != NULL ? [RCTConvert BOOL:json] : false;
  [(SkiaUIView *)view setOpaque:opaque];
}

RCT_CUSTOM_VIEW_PROPERTY(colorSpace, NSString, SkiaUIView) {
  NSString *value = json != NULL ? [RCTConvert NSString:json] : nil;
  bool useP3 = value != nil && [value isEqualToString:@"p3"];
  [(SkiaUIView *)view setUseP3ColorSpace:useP3];
}

#if !TARGET_OS_OSX
- (UIView *)view {
#else
- (RCTUIView *)view {
#endif
  auto skManager = [[self skiaManager] skManager];
  return [[SkiaYogaView alloc]
      initWithManager:skManager.get()
              factory:[](std::shared_ptr<RNSkia::RNSkPlatformContext> context) {
                return std::make_shared<RNSkAppleView<margelo::nitro::RNSkiaYoga::RNSkYogaView>>(
                    context);
              }];
}

@end
