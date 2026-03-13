import { BlurStyle, PointMode, Skia } from "@shopify/react-native-skia"
import type { SharedValue } from "react-native-reanimated"
import { YogaCanvas } from "react-native-skia-yoga"

const demoPath = (() => {
	const path = Skia.Path.MakeFromSVGString(
		"M0 60 C 30 0, 90 120, 120 60 S 210 0, 240 60",
	)

	if (!path) {
		throw new Error("Expected demo path to be created")
	}

	return path
})()

export function SkiaYogaTypecheck() {
	const sharedRadius = null as unknown as SharedValue<number>
	const sharedTrimEnd = null as unknown as SharedValue<number>
	const sharedBlur = null as unknown as SharedValue<number>
	const sharedText = null as unknown as SharedValue<string>
	const sharedFontSize = null as unknown as SharedValue<number>
	const sharedStrokeWidth = null as unknown as SharedValue<number>
	const sharedLineX = null as unknown as SharedValue<number>

	const invalidChildren = (
		// @ts-expect-error raw text children are unsupported
		<text>Hello</text>
	)

	const invalidLegacyProps = (
		<>
			{
				// @ts-expect-error blurMaskFilter uses blurStyle now
				<blurMaskFilter blur={8} style={BlurStyle.Normal} />
			}
			{
				// @ts-expect-error circle uses radius now
				<circle r={40} />
			}
			{
				// @ts-expect-error line uses from/to now
				<line p1={{ x: 0, y: 0 }} p2={{ x: 10, y: 10 }} />
			}
			{
				// @ts-expect-error points uses pointMode now
				<points mode={PointMode.Points} points={[]} />
			}
			{
				// @ts-expect-error path uses trimStart/trimEnd now
				<path path={demoPath} start={0} end={1} />
			}
			{
				// @ts-expect-error rrect uses cornerRadius now
				<rrect r={12} />
			}
			{
				// @ts-expect-error text uses text/textStyle now
				<text style={{ color: "#fff" }}>legacy</text>
			}
			{
				// @ts-expect-error paragraph uses text/paragraphStyle now
				<paragraph style={{ color: "#fff" }}>legacy</paragraph>
			}
		</>
	)

	void invalidChildren
	void invalidLegacyProps

	return (
		<YogaCanvas style={{ flex: 1 }}>
			<rect
				style={{
					alignItems: "center",
					backgroundColor: "#101418",
					flex: 1,
					gap: 16,
					justifyContent: "center",
				}}
			>
				<blurMaskFilter blur={8} blurStyle={BlurStyle.Normal}>
					<group style={{ opacity: 0.85 }}>
						<circle
							radius={40}
							style={{
								backgroundColor: "#f2f7f5",
								height: 80,
								width: 80,
							}}
						/>
						<path
							path={demoPath}
							stroke={{ width: sharedStrokeWidth }}
							style={{
								backgroundColor: "#8bd3dd",
								height: 120,
								width: 240,
							}}
						/>
					</group>
				</blurMaskFilter>
				<line
					from={{ x: sharedLineX, y: 0 }}
					to={{ x: 10, y: 10 }}
					style={{
						backgroundColor: "#f2f7f5",
						height: 10,
						width: 10,
					}}
				/>
				<points
					pointMode={PointMode.Points}
					points={[
						{ x: 0, y: 0 },
						{ x: 12, y: 12 },
					]}
					style={{
						backgroundColor: "#8bd3dd",
						height: 12,
						width: 12,
					}}
				/>
				<image
					image={null}
					fit="contain"
					style={{
						height: 64,
						width: 64,
					}}
				/>
				<paragraph
					style={{
						maxWidth: 260,
					}}
					paragraphStyle={{
						color: "#f2f7f5",
						fontSize: sharedFontSize,
					}}
					text="Package-owned JSX typings compile against the supported node set."
				/>
				<text
					text="Hello"
					textStyle={{
						color: "#8bd3dd",
						fontSize: 14,
					}}
				/>
				<circle
					radius={sharedRadius}
					style={{
						backgroundColor: "#caffbf",
						height: 32,
						width: 32,
					}}
				/>
				<path
					path={demoPath}
					trimEnd={sharedTrimEnd}
					style={{
						backgroundColor: "#ffd6a5",
						height: 80,
						width: 160,
					}}
				/>
				<blurMaskFilter blur={sharedBlur}>
					<text text={sharedText} />
				</blurMaskFilter>
				<rrect
					cornerRadius={12}
					style={{
						backgroundColor: "#2b333b",
						height: 48,
						width: 96,
					}}
				/>
				<oval
					style={{
						backgroundColor: "#ffadad",
						height: 40,
						width: 60,
					}}
				/>
			</rect>
		</YogaCanvas>
	)
}
