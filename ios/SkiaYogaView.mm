#import "SkiaYogaView.h"

#import <QuartzCore/CADisplayLink.h>

#include "RNSkYogaView.hpp"

#ifdef RCT_NEW_ARCH_ENABLED
#import "RNSkAppleView.h"
#import "RNSkPlatformContext.h"
#import "SkiaManager.h"
#import <React/RCTConversions.h>
#import <React/RCTFabricComponentsPlugins.h>

#import <react/renderer/components/RNSkiaYogaSpec/ComponentDescriptors.h>
#import <react/renderer/components/RNSkiaYogaSpec/Props.h>
#import <react/renderer/components/RNSkiaYogaSpec/RCTComponentViewHelpers.h>
#endif

@class SkiaYogaView;

@interface SkiaYogaDisplayLinkTarget : NSObject

@property(nonatomic, weak) SkiaYogaView *view;

- (void)displayLinkFired:(CADisplayLink *)displayLink;

@end

@interface SkiaYogaView ()

- (void)displayLinkFired:(CADisplayLink *)displayLink;
- (void)startDisplayLink;
- (void)stopDisplayLink;
- (void)connectSchedulerIfNeeded;

@end

@implementation SkiaYogaDisplayLinkTarget

- (void)displayLinkFired:(CADisplayLink *)displayLink {
  [self.view displayLinkFired:displayLink];
}

@end

@implementation SkiaYogaView {
  CADisplayLink *_displayLink;
  SkiaYogaDisplayLinkTarget *_displayLinkTarget;
}

#ifdef RCT_NEW_ARCH_ENABLED
- (instancetype)initWithFrame:(CGRect)frame {
  if (self = [super initWithFrame:frame]) {
    // Mirror SkiaPictureView's setup so _factory is initialized for Fabric.
    auto skManager = [SkiaManager latestActiveSkManager].get();
    [self initCommon:skManager
             factory:[](std::shared_ptr<RNSkia::RNSkPlatformContext> context) {
               return std::make_shared<
                   RNSkAppleView<margelo::nitro::RNSkiaYoga::RNSkYogaView>>(
                   context);
             }];
  }
  return self;
}
#endif

- (void)displayLinkFired:(CADisplayLink *)displayLink {
  (void)displayLink;

  auto impl = [self impl];
  if (impl == nullptr) {
    [self stopDisplayLink];
    return;
  }

  auto view = std::dynamic_pointer_cast<margelo::nitro::RNSkiaYoga::RNSkYogaView>(
      impl->getDrawView());
  if (view == nullptr || !view->onFrame()) {
    [self stopDisplayLink];
  }
}

- (void)startDisplayLink {
  if (_displayLink != nil) {
    return;
  }

  _displayLinkTarget = [SkiaYogaDisplayLinkTarget new];
  _displayLinkTarget.view = self;
  _displayLink = [CADisplayLink displayLinkWithTarget:_displayLinkTarget
                                             selector:@selector(displayLinkFired:)];

  NSInteger maximumFPS = UIScreen.mainScreen.maximumFramesPerSecond;
  if (@available(iOS 15.0, tvOS 15.0, *)) {
    float targetFPS = maximumFPS > 0 ? (float)maximumFPS : 60.0f;
    CAFrameRateRange rate =
        CAFrameRateRangeMake(targetFPS, targetFPS, targetFPS);
    _displayLink.preferredFrameRateRange = rate;
  } else {
    _displayLink.preferredFramesPerSecond = maximumFPS;
  }

  [_displayLink addToRunLoop:[NSRunLoop mainRunLoop]
                     forMode:NSRunLoopCommonModes];
}

- (void)stopDisplayLink {
  if (_displayLink == nil) {
    return;
  }

  [_displayLink invalidate];
  _displayLink = nil;
  _displayLinkTarget = nil;
}

- (void)connectSchedulerIfNeeded {
  auto impl = [self impl];
  if (impl == nullptr) {
    return;
  }

  auto view = std::dynamic_pointer_cast<margelo::nitro::RNSkiaYoga::RNSkYogaView>(
      impl->getDrawView());
  if (view == nullptr) {
    return;
  }

  __weak SkiaYogaView *weakSelf = self;
  view->setSchedulerCallbacks(
      [weakSelf]() {
        dispatch_async(dispatch_get_main_queue(), ^{
          [weakSelf startDisplayLink];
        });
      },
      [weakSelf]() {
        dispatch_async(dispatch_get_main_queue(), ^{
          [weakSelf stopDisplayLink];
        });
      });
}

#if !TARGET_OS_OSX
- (void)willMoveToSuperview:(UIView *)newSuperview {
  [super willMoveToSuperview:newSuperview];

  if (newSuperview != nil) {
    [self connectSchedulerIfNeeded];
  } else {
    [self stopDisplayLink];
  }
}
#else
- (void)viewWillMoveToSuperview:(NSView *)newSuperview {
  [super viewWillMoveToSuperview:newSuperview];

  if (newSuperview != nil) {
    [self connectSchedulerIfNeeded];
  } else {
    [self stopDisplayLink];
  }
}
#endif

- (void)removeFromSuperview {
  [self stopDisplayLink];
  [super removeFromSuperview];
}

- (void)dealloc {
  [self stopDisplayLink];
}

#ifdef RCT_NEW_ARCH_ENABLED
#pragma mark - RCTComponentViewProtocol

+ (facebook::react::ComponentDescriptorProvider)componentDescriptorProvider
{
    return facebook::react::concreteComponentDescriptorProvider<
      facebook::react::SkiaYogaViewComponentDescriptor>();
}

- (void)updateProps:(const facebook::react::Props::Shared &)props
           oldProps:(const facebook::react::Props::Shared &)oldProps
{
  const auto &newProps =
      *std::static_pointer_cast<const facebook::react::SkiaYogaViewProps>(
          props);
  [super updateProps:props oldProps:oldProps];

  int nativeId =
      [[RCTConvert NSString:RCTNSStringFromString(newProps.nativeId)] intValue];
  [self setNativeId:nativeId];
  [self setDebugMode:newProps.debug];
  [self setOpaque:newProps.opaque];

  if (newProps.colorSpace == "" || newProps.colorSpace == "srgb") {
    [self setUseP3ColorSpace:false];
  } else if (newProps.colorSpace == "p3") {
    [self setUseP3ColorSpace:true];
  }
}
#endif

@end

#ifdef RCT_NEW_ARCH_ENABLED
Class<RCTComponentViewProtocol> SkiaYogaViewCls(void) {
  return SkiaYogaView.class;
}
#endif
