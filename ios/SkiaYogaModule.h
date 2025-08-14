 #pragma once

#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>

#ifdef __cplusplus
namespace RNSkia { class RNSkApplePlatformContext; }
#endif

@interface SkiaYogaModule : NSObject <RCTBridgeModule>

#ifdef __cplusplus
- (RNSkia::RNSkApplePlatformContext *)manager; // Returns non-owning raw pointer
#endif

@end
