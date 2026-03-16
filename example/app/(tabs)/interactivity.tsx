import { Gesture } from "react-native-gesture-handler"
import { useMemo, useRef, useState } from "react"
import { ScrollView, StyleSheet, Text, View } from "react-native"
import {
	type SharedValue,
	useDerivedValue,
	useSharedValue,
	withTiming,
} from "react-native-reanimated"
import { YogaCanvas } from "react-native-skia-yoga"

type Matrix3 = [
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
]

function clamp(value: number, min: number, max: number) {
	"worklet"

	return Math.min(max, Math.max(min, value))
}

function createTranslateScaleMatrix(
	x: number,
	y: number,
	scale: number,
): Matrix3 {
	"worklet"

	return [scale, 0, x, 0, scale, y, 0, 0, 1]
}

function createScaleAroundMatrix(
	centerX: number,
	centerY: number,
	scale: number,
): Matrix3 {
	"worklet"

	return [
		scale,
		0,
		centerX - scale * centerX,
		0,
		scale,
		centerY - scale * centerY,
		0,
		0,
		1,
	]
}

function DemoCard({
	children,
	description,
	kicker,
	title,
}: {
	children: React.ReactNode
	description: string
	kicker: string
	title: string
}) {
	return (
		<View style={styles.card}>
			<View style={styles.copyBlock}>
				<Text style={styles.kicker}>{kicker}</Text>
				<Text style={styles.cardTitle}>{title}</Text>
				<Text style={styles.cardDescription}>{description}</Text>
			</View>
			{children}
		</View>
	)
}

function CanvasShell({
	children,
	height = 280,
}: {
	children: React.ReactNode
	height?: number
}) {
	return <View style={[styles.canvasShell, { height }]}>{children}</View>
}

function StatRow({ label, value }: { label: string; value: string }) {
	return (
		<View style={styles.statRow}>
			<Text style={styles.statLabel}>{label}</Text>
			<Text style={styles.statValue}>{value}</Text>
		</View>
	)
}

function PressPreview({
	active,
	onPress,
	onPressIn,
	onPressOut,
}: {
	active: SharedValue<number>
	onPress: () => void
	onPressIn: () => void
	onPressOut: () => void
}) {
	const matrix = useDerivedValue(() => {
		return createTranslateScaleMatrix(0, 0, 1 - active.value * 0.07)
	})
	const pulseOpacity = useDerivedValue(() => {
		return 0.35 + active.value * 0.65
	})

	return (
		<YogaCanvas style={styles.canvas}>
			<rect
				style={{
					alignItems: "center",
					backgroundColor: "#041018",
					flex: 1,
					justifyContent: "center",
					padding: 24,
				}}
			>
				<group
					hitSlop={20}
					onPress={onPress}
					onPressIn={onPressIn}
					onPressOut={onPressOut}
					preciseHit
					style={{ matrix }}
				>
					<rrect
						cornerRadius={30}
						style={{
							alignItems: "center",
							backgroundColor: "#14b8a6",
							height: 138,
							justifyContent: "center",
							width: 220,
						}}
					>
						<circle
							radius={22}
							style={{
								backgroundColor: "#0f172a",
								height: 44,
								width: 44,
							}}
						/>
						<rect
							style={{
								backgroundColor: "#0f172a",
								borderRadius: 999,
								height: 12,
								marginTop: 16,
								opacity: pulseOpacity,
								width: 112,
							}}
						/>
					</rrect>
				</group>
			</rect>
		</YogaCanvas>
	)
}

function PressDemo() {
	const active = useSharedValue(0)
	const [pressCount, setPressCount] = useState(0)
	const [stateLabel, setStateLabel] = useState("idle")

	return (
		<DemoCard
			kicker="Built-in Node Press"
			title="Press feedback without per-node views"
			description="The target uses native hit-testing with `preciseHit` and `hitSlop`, while visual feedback stays on shared values."
		>
			<CanvasShell>
				<PressPreview
					active={active}
					onPress={() => {
						setPressCount((count) => count + 1)
						setStateLabel("pressed")
					}}
					onPressIn={() => {
						active.value = withTiming(1, { duration: 120 })
						setStateLabel("press in")
					}}
					onPressOut={() => {
						active.value = withTiming(0, { duration: 160 })
						setStateLabel("press out")
					}}
				/>
			</CanvasShell>
			<View style={styles.stats}>
				<StatRow label="State" value={stateLabel} />
				<StatRow label="Presses" value={String(pressCount)} />
				<StatRow label="Target" value="rounded rect + circular notch" />
			</View>
		</DemoCard>
	)
}

function DragPreview({
	dragging,
	onPanEnd,
	onPanStart,
	onPanUpdate,
	translateX,
	translateY,
}: {
	dragging: SharedValue<number>
	onPanEnd: (translationX: number, translationY: number) => void
	onPanStart: () => void
	onPanUpdate: (translationX: number, translationY: number) => void
	translateX: SharedValue<number>
	translateY: SharedValue<number>
}) {
	const matrix = useDerivedValue(() => {
		return createTranslateScaleMatrix(
			translateX.value,
			translateY.value,
			1 + dragging.value * 0.04,
		)
	})

	return (
		<YogaCanvas style={styles.canvas}>
			<rect
				style={{
					alignItems: "center",
					backgroundColor: "#041018",
					flex: 1,
					justifyContent: "center",
					padding: 24,
				}}
			>
				<rect
					style={{
						alignItems: "center",
						backgroundColor: "#0b2230",
						borderRadius: 32,
						height: 200,
						justifyContent: "center",
						width: 260,
					}}
				>
					<group
						hitSlop={14}
						onPanEnd={(event) => {
							onPanEnd(event.translationX, event.translationY)
						}}
						onPanStart={onPanStart}
						onPanUpdate={(event) => {
							onPanUpdate(event.translationX, event.translationY)
						}}
						preciseHit
						style={{ matrix }}
					>
						<rrect
							cornerRadius={26}
							style={{
								alignItems: "center",
								backgroundColor: "#f97316",
								height: 110,
								justifyContent: "center",
								width: 150,
							}}
						>
							<circle
								radius={18}
								style={{
									backgroundColor: "#111827",
									height: 36,
									width: 36,
								}}
							/>
						</rrect>
					</group>
				</rect>
			</rect>
		</YogaCanvas>
	)
}

function PanDemo() {
	const dragging = useSharedValue(0)
	const translateX = useSharedValue(0)
	const translateY = useSharedValue(0)
	const settledPosition = useRef({ x: 0, y: 0 })
	const [status, setStatus] = useState("ready")

	return (
		<DemoCard
			kicker="Built-in Node Pan"
			title="Drag a canvas node"
			description="The node captures the gesture once hit-tested, then updates a matrix-backed shared value for motion."
		>
			<CanvasShell>
				<DragPreview
					dragging={dragging}
					onPanStart={() => {
						dragging.value = withTiming(1, { duration: 120 })
						setStatus("dragging")
					}}
					onPanUpdate={(deltaX, deltaY) => {
						translateX.value = clamp(
							settledPosition.current.x + deltaX,
							-56,
							56,
						)
						translateY.value = clamp(
							settledPosition.current.y + deltaY,
							-44,
							44,
						)
					}}
					onPanEnd={(deltaX, deltaY) => {
						const nextX = clamp(
							settledPosition.current.x + deltaX,
							-56,
							56,
						)
						const nextY = clamp(
							settledPosition.current.y + deltaY,
							-44,
							44,
						)
						settledPosition.current = { x: nextX, y: nextY }
						translateX.value = withTiming(nextX, { duration: 140 })
						translateY.value = withTiming(nextY, { duration: 140 })
						dragging.value = withTiming(0, { duration: 180 })
						setStatus(
							`resting at ${Math.round(nextX)}, ${Math.round(nextY)}`,
						)
					}}
					translateX={translateX}
					translateY={translateY}
				/>
			</CanvasShell>
			<View style={styles.stats}>
				<StatRow label="Status" value={status} />
				<StatRow label="Clamp" value="-56..56 x / -44..44 y" />
				<StatRow label="Motion" value="matrix shared value" />
			</View>
		</DemoCard>
	)
}

function PinchPreview({
	gesture,
	onSelect,
	scale,
	selected,
}: {
	gesture: ReturnType<typeof Gesture.Pinch>
	onSelect: (index: number) => void
	scale: SharedValue<number>
	selected: number
}) {
	const stageMatrix = useDerivedValue(() => {
		return createScaleAroundMatrix(110, 110, scale.value)
	})

	const swatches = ["#38bdf8", "#f59e0b", "#34d399"] as const

	return (
		<YogaCanvas gesture={gesture} style={styles.canvas}>
			<rect
				style={{
					alignItems: "center",
					backgroundColor: "#041018",
					flex: 1,
					justifyContent: "center",
					padding: 24,
				}}
			>
				<group style={{ matrix: stageMatrix }}>
					<rrect
						cornerRadius={28}
						style={{
							backgroundColor: "#0b2230",
							height: 220,
							justifyContent: "space-between",
							padding: 22,
							width: 220,
						}}
					>
						<rect
							style={{
								backgroundColor: "#17354d",
								borderRadius: 999,
								height: 14,
								opacity: 0.75,
								width: 120,
							}}
						/>
						<group
							style={{
								alignItems: "center",
								flexDirection: "row",
								justifyContent: "space-between",
							}}
						>
							{swatches.map((color, index) => {
								const active = selected === index
								return (
									<circle
										hitSlop={12}
										key={color}
										onPress={() => {
											onSelect(index)
										}}
										preciseHit
										radius={active ? 28 : 24}
										style={{
											backgroundColor: color,
											height: active ? 56 : 48,
											opacity: active ? 1 : 0.72,
											width: active ? 56 : 48,
										}}
									/>
								)
							})}
						</group>
						<rect
							style={{
								alignSelf: "flex-end",
								backgroundColor: swatches[selected],
								borderRadius: 999,
								height: 16,
								opacity: 0.9,
								width: 74,
							}}
						/>
					</rrect>
				</group>
			</rect>
		</YogaCanvas>
	)
}

function GestureDemo() {
	const scale = useSharedValue(1)
	const savedScale = useSharedValue(1)
	const [selected, setSelected] = useState(0)

	const gesture = useMemo(() => {
		return Gesture.Pinch()
			.onUpdate((event) => {
				"worklet"

				scale.value = clamp(savedScale.value * event.scale, 0.75, 2.1)
			})
			.onEnd(() => {
				"worklet"

				savedScale.value = scale.value
			})
	}, [savedScale, scale])

	return (
		<DemoCard
			kicker="Simultaneous Gesture"
			title="Pinch the canvas, still press the nodes"
			description="A custom RNGH pinch gesture runs on the canvas at the same time as node-level press handling."
		>
			<CanvasShell>
				<PinchPreview
					gesture={gesture}
					onSelect={setSelected}
					scale={scale}
					selected={selected}
				/>
			</CanvasShell>
			<View style={styles.stats}>
				<StatRow label="Canvas gesture" value="pinch to zoom" />
				<StatRow
					label="Node gesture"
					value={`selected dot ${selected + 1}`}
				/>
				<StatRow label="Composition" value="simultaneous" />
			</View>
		</DemoCard>
	)
}

export default function InteractivityScreen() {
	return (
		<ScrollView
			contentContainerStyle={styles.content}
			style={styles.container}
		>
			<View style={styles.hero}>
				<Text style={styles.title}>Interactivity</Text>
				<Text style={styles.description}>
					These examples cover the new node-level press and pan
					callbacks plus the canvas-level `gesture` prop for composing
					custom RNGH handlers.
				</Text>
			</View>
			<PressDemo />
			<PanDemo />
			<GestureDemo />
		</ScrollView>
	)
}

const styles = StyleSheet.create({
	canvas: {
		flex: 1,
	},
	canvasShell: {
		backgroundColor: "#040b12",
		borderColor: "#17354d",
		borderRadius: 22,
		borderWidth: 1,
		overflow: "hidden",
	},
	card: {
		backgroundColor: "#102232",
		borderColor: "#17354d",
		borderRadius: 24,
		borderWidth: 1,
		gap: 14,
		padding: 16,
	},
	cardDescription: {
		color: "#8ca2b5",
		fontSize: 14,
		lineHeight: 21,
	},
	cardTitle: {
		color: "#f3f8fb",
		fontSize: 22,
		fontWeight: "700",
	},
	container: {
		backgroundColor: "#08131d",
		flex: 1,
	},
	content: {
		gap: 18,
		padding: 20,
		paddingBottom: 120,
	},
	copyBlock: {
		gap: 6,
	},
	description: {
		color: "#8ca2b5",
		fontSize: 15,
		lineHeight: 22,
	},
	hero: {
		gap: 8,
	},
	kicker: {
		color: "#67e8f9",
		fontSize: 12,
		fontWeight: "700",
		letterSpacing: 0.8,
		textTransform: "uppercase",
	},
	statLabel: {
		color: "#8ca2b5",
		fontSize: 13,
	},
	statRow: {
		alignItems: "center",
		flexDirection: "row",
		justifyContent: "space-between",
	},
	stats: {
		backgroundColor: "#0c1a27",
		borderColor: "#17354d",
		borderRadius: 16,
		borderWidth: 1,
		gap: 8,
		paddingHorizontal: 14,
		paddingVertical: 12,
	},
	statValue: {
		color: "#f3f8fb",
		fontSize: 13,
		fontWeight: "600",
	},
	title: {
		color: "#f3f8fb",
		fontSize: 30,
		fontWeight: "700",
	},
})
