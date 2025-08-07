# react-native-skia-yoga

A React Native C++ library that combines the [Yoga](https://www.yogalayout.dev/) CSS-like layout engine with [Skia](https://shopify.github.io/react-native-skia/) to efficiently render declarative, complex and interactive user interfaces.

> [!CAUTION]
> This library is in early development and not ready for production use.

## Usage

```tsx
import { Canvas, View, Text } from 'react-native-skia-yoga';

<Canvas style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
  <View style={{ width: 100, height: 100, backgroundColor: 'red', flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <Text style={{ fontSize: 20, color: 'white', textAlign: 'center' }}>Hello, world!</Text>
  </View>
</Canvas>
```

## Future Goal: Flutter for React Native

- **Pressables**: to detect when an element inside of the canvas is being pressed
- **Gesture Handler**: pressables in combination with `react-native-gesture-handler` to create complex and performant gestures 
- **Reanimated**: to create animations and styling using `react-native-reanimated`
- **Portal**: to be able to render react-native components "inside" of the canvas

This way the entire react-native ecosystem can be leveraged while being able to use Skia as highly customizable and performant renderer.
