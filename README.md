# react-native-skia-yoga

A React Native C++ library that combines the [Yoga](https://www.yogalayout.dev/) CSS-like layout engine with [Skia](https://shopify.github.io/react-native-skia/) to efficiently render declarative, complex and interactive user interfaces.

> [!CAUTION]
> This library is in early development and not ready for production use.

## Usage

```tsx
import { Canvas, View, Text } from "react-native-skia-yoga"

function Example() {
	return (
		<Canvas
			style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
		>
			<View
				style={{
					width: 100,
					height: 100,
					backgroundColor: "red",
					flex: 1,
					justifyContent: "center",
					alignItems: "center",
				}}
			>
				<Text
					style={{
						fontSize: 20,
						color: "white",
						textAlign: "center",
					}}
				>
					Hello, world!
				</Text>
			</View>
		</Canvas>
	)
}
```

## Interactivity

`YogaCanvas` now installs a single `react-native-gesture-handler` detector around the Skia surface and uses native hit-testing against the retained Yoga/Skia node tree.

Wrap your app in `GestureHandlerRootView`, then attach handlers directly to canvas nodes:

```tsx
import { useSharedValue } from "react-native-reanimated"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import { YogaCanvas } from "react-native-skia-yoga"

function Example() {
	const opacity = useSharedValue(1)

	return (
		<GestureHandlerRootView style={{ flex: 1 }}>
			<YogaCanvas style={{ flex: 1 }}>
				<group
					onPressIn={() => {
						opacity.value = 0.8
					}}
					onPressOut={() => {
						opacity.value = 1
					}}
					onPress={() => {
						console.log("pressed")
					}}
					onPanUpdate={(event) => {
						console.log(event.translationX, event.translationY)
					}}
					preciseHit
					hitSlop={12}
				>
					<rrect
						cornerRadius={16}
						style={{
							width: 180,
							height: 64,
							backgroundColor: "#111827",
							opacity,
						}}
					/>
				</group>
			</YogaCanvas>
		</GestureHandlerRootView>
	)
}
```

Supported interaction props on all nodes:

- `onPress`
- `onPressIn`
- `onPressOut`
- `onPanStart`
- `onPanUpdate`
- `onPanEnd`
- `pointerEvents`
- `hitSlop`
- `preciseHit`

`YogaCanvas` also accepts a canvas-level `gesture` prop so custom RNGH gestures can run simultaneously with the built-in node interaction layer.

## Future Goal: Flutter for React Native

- **Pressables**: to detect when an element inside of the canvas is being pressed
- **Gesture Handler**: pressables in combination with `react-native-gesture-handler` to create complex and performant gestures
- **Reanimated**: to create animations and styling using `react-native-reanimated`
- **Portal**: to be able to render react-native components "inside" of the canvas

This way the entire react-native ecosystem can be leveraged while being able to use Skia as highly customizable and performant renderer.
