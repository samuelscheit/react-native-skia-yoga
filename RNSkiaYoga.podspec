require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "RNSkiaYoga"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => "13.0", :tvos => "13.0", :osx => "11" }
  s.source       = { :git => "https://github.com/mrousavy/nitro.git", :tag => "#{s.version}" }

  s.source_files = [
    # Implementation (Swift)
    "ios/**/*.{swift}",
    # Autolinking/Registration (Objective-C++)
    "ios/**/*.{m,mm,h}",
    # Implementation (C++ objects)
    "cpp/**/*.{hpp,cpp}",
  ]

  # Configure header search paths to find React Native Skia and Skia headers
  s.pod_target_xcconfig = {
    'HEADER_SEARCH_PATHS' => [
      '"$(PODS_TARGET_SRCROOT)/cpp/**"',
	  '"$(PODS_ROOT)/../../node_modules/@shopify/react-native-skia/cpp/**"',
	  '"$(PODS_ROOT)/../../node_modules/@shopify/react-native-skia/cpp/skia"',
	  '"$(PODS_ROOT)/../../node_modules/@shopify/react-native-skia/cpp/skia/**"',
    ].join(' '),
	'CLANG_CXX_LANGUAGE_STANDARD' => 'c++20',
	'CLANG_CXX_LIBRARY' => 'libc++',
	'OTHER_CPLUSPLUSFLAGS' => [
		'$(inherited)',
		'-include',
		'"$(PODS_TARGET_SRCROOT)/cpp/polyfill.h"', # <- new
		'-std=c++20',
    # '-fvisibility=hidden',
    # '-fvisibility-inlines-hidden'
	].join(' '),
    # 'DEFINES_MODULE' => 'YES',
    'GCC_PREPROCESSOR_DEFINITIONS' => [
		# SK_METAL=1 SK_GANESH=1 SK_IMAGE_READ_PIXELS_DISABLE_LEGACY_API=1 SK_DISABLE_LEGACY_SHAPER_FACTORY=1
      '$(inherited)',
      'SK_METAL=1',
	  'SK_GANESH=1',
	  'SK_IMAGE_READ_PIXELS_DISABLE_LEGACY_API=1',
	  'SK_DISABLE_LEGACY_SHAPER_FACTORY=1',
    ].join(' ')
  }

  load 'nitrogen/generated/ios/RNSkiaYoga+autolinking.rb'
  add_nitrogen_files(s)

  s.dependency 'Yoga'
#   s.dependency 'react-native-skia/Jsi'
  s.dependency 'react-native-yoga-jsi'
  s.dependency 'React-jsi'
  s.dependency 'React-callinvoker'
  install_modules_dependencies(s)
end
