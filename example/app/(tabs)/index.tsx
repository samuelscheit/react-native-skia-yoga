import { SafeAreaView } from "react-native-safe-area-context";
import { SkiaYoga } from "react-native-skia-yoga";
import { Gutter } from "react-native-yoga-jsi";
import { ThemedText } from "../../components/ThemedText";

console.log(SkiaYoga);

const node = Yoga.Node.create();
node.setWidth(100);
node.setHeight(100);
const x = node.setGap(Gutter.All, 10);
const gap = node.getGap(Gutter.All);
console.log(gap, x, node);

// @ts-ignore
globalThis.node = node;

export default function HomeScreen() {
	return (
		<SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
			<ThemedText style={{ fontSize: 50, lineHeight: 50 }}>Hello</ThemedText>
		</SafeAreaView>
	);
}
