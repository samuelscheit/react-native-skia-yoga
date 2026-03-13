import { useEffect, useMemo, useRef, useState } from "react"
import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native"
import {
	cancelAnimation,
	Easing,
	useDerivedValue,
	useSharedValue,
	withRepeat,
	withTiming,
} from "react-native-reanimated"
import { YogaCanvas } from "react-native-skia-yoga"

type BenchmarkMode = "native" | "js" | "static"

type BenchmarkSummary = {
	avgFrameMs: number
	completed: boolean
	count: number
	droppedFrames: number
	elapsedMs: number
	fps: number
	frameCount: number
	maxFrameMs: number
	mode: BenchmarkMode
	p95FrameMs: number
}

const BENCHMARK_DURATION_MS = 10_000
const COUNT_OPTIONS = [24, 96, 196] as const
const MODE_OPTIONS: readonly BenchmarkMode[] = ["native", "js", "static"]
const SWATCHES = [
	"#7dd3fc",
	"#fda4af",
	"#fde68a",
	"#86efac",
	"#c4b5fd",
	"#f9a8d4",
] as const

function percentile(values: number[], ratio: number) {
	if (values.length === 0) {
		return 0
	}

	const sorted = [...values].sort((a, b) => a - b)
	const index = Math.min(
		sorted.length - 1,
		Math.max(0, Math.ceil(sorted.length * ratio) - 1),
	)
	return sorted[index] ?? 0
}

function summarizeRun(
	mode: BenchmarkMode,
	count: number,
	frameTimes: number[],
	elapsedMs: number,
	completed: boolean,
): BenchmarkSummary {
	const total = frameTimes.reduce((sum, frameTime) => sum + frameTime, 0)
	const avgFrameMs = frameTimes.length > 0 ? total / frameTimes.length : 0
	const fps = avgFrameMs > 0 ? 1000 / avgFrameMs : 0
	const droppedFrames = frameTimes.filter(
		(frameTime) => frameTime > 20,
	).length

	return {
		avgFrameMs,
		completed,
		count,
		droppedFrames,
		elapsedMs,
		fps,
		frameCount: frameTimes.length,
		maxFrameMs: frameTimes.length > 0 ? Math.max(...frameTimes) : 0,
		mode,
		p95FrameMs: percentile(frameTimes, 0.95),
	}
}

function useBenchmarkRun(
	mode: BenchmarkMode,
	count: number,
	runId: number,
	running: boolean,
	onComplete: (summary: BenchmarkSummary) => void,
) {
	const [summary, setSummary] = useState<BenchmarkSummary | null>(null)
	const onCompleteRef = useRef(onComplete)

	useEffect(() => {
		onCompleteRef.current = onComplete
	}, [onComplete])

	useEffect(() => {
		if (!running) {
			return
		}

		let animationFrame = 0
		let cancelled = false
		const frameTimes: number[] = []
		const startTime = performance.now()
		let previousTime = startTime
		let lastPublishTime = startTime

		const publish = (now: number, completed: boolean) => {
			const nextSummary = summarizeRun(
				mode,
				count,
				frameTimes,
				now - startTime,
				completed,
			)
			setSummary(nextSummary)
			if (completed) {
				onCompleteRef.current(nextSummary)
			}
		}

		const tick = (now: number) => {
			if (cancelled) {
				return
			}

			const frameTime = now - previousTime
			previousTime = now
			if (frameTime > 0) {
				frameTimes.push(frameTime)
			}

			if (now - lastPublishTime >= 250) {
				lastPublishTime = now
				publish(now, false)
			}

			if (now - startTime >= BENCHMARK_DURATION_MS) {
				publish(now, true)
				return
			}

			animationFrame = requestAnimationFrame(tick)
		}

		setSummary(summarizeRun(mode, count, [], 0, false))
		animationFrame = requestAnimationFrame(tick)

		return () => {
			cancelled = true
			if (animationFrame) {
				cancelAnimationFrame(animationFrame)
			}
		}
	}, [count, mode, runId, running])

	return summary
}

function formatMetric(value: number, digits = 1) {
	return value.toFixed(digits)
}

function BenchmarkScene({
	count,
	mode,
	running,
}: {
	count: number
	mode: BenchmarkMode
	running: boolean
}) {
	const progress = useSharedValue(0)
	const radius = useSharedValue(5)
	const blur = useSharedValue(0)

	useEffect(() => {
		cancelAnimation(progress)
		if (!running || mode === "static") {
			progress.value = 0
			radius.value = 5
			blur.value = 0
			return
		}

		progress.value = withRepeat(
			withTiming(1, {
				duration: 1800,
				easing: Easing.inOut(Easing.ease),
			}),
			-1,
			true,
		)

		return () => {
			cancelAnimation(progress)
		}
	}, [blur, mode, progress, radius, running])

	useDerivedValue(() => {
		const t = progress.value
		radius.value = 4 + t * 5
		blur.value = 2 + t * 6
	})

	return (
		<rect
			style={{
				alignItems: "center",
				backgroundColor: "#08131d",
				flex: 1,
				justifyContent: "center",
				padding: 24,
				flexWrap: "wrap",
				flexDirection: "row",
				maxWidth: 100,
			}}
		>
			{Array.from({ length: count }, (_, index) => (
				<circle
					key={index}
					radius={mode === "static" ? 5 : radius}
					style={{
						backgroundColor: SWATCHES[index % SWATCHES.length],
						height: 18,
						width: 18,
					}}
				/>
			))}
		</rect>
	)
}

function OptionRow<T extends string | number>({
	label,
	options,
	selected,
	onSelect,
}: {
	label: string
	options: readonly T[]
	selected: T
	onSelect: (next: T) => void
}) {
	return (
		<View style={styles.optionRow}>
			<Text style={styles.optionLabel}>{label}</Text>
			<View style={styles.optionGroup}>
				{options.map((option) => {
					const active = option === selected
					return (
						<Pressable
							key={String(option)}
							onPress={() => onSelect(option)}
							style={[
								styles.optionChip,
								active && styles.optionChipActive,
							]}
						>
							<Text
								style={[
									styles.optionChipText,
									active && styles.optionChipTextActive,
								]}
							>
								{String(option)}
							</Text>
						</Pressable>
					)
				})}
			</View>
		</View>
	)
}

export default function BenchmarkScreen() {
	const [count, setCount] = useState<number>(COUNT_OPTIONS[1])
	const [mode, setMode] = useState<BenchmarkMode>("native")
	const [runId, setRunId] = useState(0)
	const [running, setRunning] = useState(false)

	const summary = useBenchmarkRun(
		mode,
		count,
		runId,
		running,
		(nextSummary) => {
			console.log("benchmark-summary", JSON.stringify(nextSummary))
			setRunning(false)
		},
	)

	useEffect(() => {
		setRunning(false)
	}, [count, mode])

	const canvasKey = useMemo(
		() => `${mode}:${count}:${runId}`,
		[count, mode, runId],
	)

	const benchmarkModeLabel =
		mode === "native"
			? "Synchronizable command bindings"
			: mode === "js"
				? "JS command rebuilds"
				: "Static baseline"

	return (
		<View
			style={{
				flex: 1,
			}}
		>
			<YogaCanvas
				key={canvasKey}
				animationBindingMode={mode === "js" ? "js" : "native"}
				style={{
					flex: 1,
				}}
			>
				<BenchmarkScene count={count} mode={mode} running={running} />
			</YogaCanvas>

			<View
				pointerEvents="box-none"
				style={{
					flex: 0,
				}}
			>
				<View style={styles.panel}>
					<Text style={styles.title}>Benchmark</Text>
					<Text style={styles.subtitle}>{benchmarkModeLabel}</Text>

					<OptionRow
						label="Mode"
						options={MODE_OPTIONS}
						selected={mode}
						onSelect={setMode}
					/>
					<OptionRow
						label="Count"
						options={COUNT_OPTIONS}
						selected={count}
						onSelect={setCount}
					/>

					<View style={styles.actions}>
						<Pressable
							onPress={() => {
								setRunId((current) => current + 1)
								setRunning(true)
							}}
							style={[styles.actionButton, styles.primaryButton]}
						>
							<Text
								style={[
									styles.actionButtonText,
									styles.primaryButtonText,
								]}
							>
								{running ? "Restart 10s run" : "Start 10s run"}
							</Text>
						</Pressable>
						<Pressable
							onPress={() => setRunning(false)}
							style={[
								styles.actionButton,
								styles.secondaryButton,
							]}
						>
							<Text style={styles.actionButtonText}>Stop</Text>
						</Pressable>
					</View>

					<View style={styles.metrics}>
						<Text style={styles.metricLine}>
							Status:{" "}
							{running
								? "running"
								: summary?.completed
									? "complete"
									: "idle"}
						</Text>
						<Text style={styles.metricLine}>
							FPS: {formatMetric(summary?.fps ?? 0)}
						</Text>
						<Text style={styles.metricLine}>
							Avg frame: {formatMetric(summary?.avgFrameMs ?? 0)}{" "}
							ms
						</Text>
						<Text style={styles.metricLine}>
							P95 frame: {formatMetric(summary?.p95FrameMs ?? 0)}{" "}
							ms
						</Text>
						<Text style={styles.metricLine}>
							Max frame: {formatMetric(summary?.maxFrameMs ?? 0)}{" "}
							ms
						</Text>
						<Text style={styles.metricLine}>
							Dropped ({">"}20ms): {summary?.droppedFrames ?? 0}
						</Text>
						<Text style={styles.metricLine}>
							Elapsed:{" "}
							{formatMetric((summary?.elapsedMs ?? 0) / 1000, 2)}{" "}
							s
						</Text>
						<Text style={styles.metricLine}>
							Frames: {summary?.frameCount ?? 0}
						</Text>
					</View>
				</View>
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	actionButton: {
		alignItems: "center",
		borderRadius: 10,
		flex: 1,
		paddingHorizontal: 12,
		paddingVertical: 10,
	},
	actionButtonText: {
		color: "#dbe7f0",
		fontSize: 14,
		fontWeight: "600",
	},
	actions: {
		flexDirection: "row",
		gap: 10,
	},
	canvas: {
		flex: 1,
	},
	metricLine: {
		color: "#b9cad8",
		fontSize: 12,
		fontVariant: ["tabular-nums"],
	},
	metrics: {
		gap: 4,
	},
	optionChip: {
		backgroundColor: "rgba(255,255,255,0.08)",
		borderRadius: 999,
		paddingHorizontal: 10,
		paddingVertical: 6,
	},
	optionChipActive: {
		backgroundColor: "#38bdf8",
	},
	optionChipText: {
		color: "#c6d4df",
		fontSize: 12,
		fontWeight: "600",
		textTransform: "capitalize",
	},
	optionChipTextActive: {
		color: "#062033",
	},
	optionGroup: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 8,
	},
	optionLabel: {
		color: "#7f95a6",
		fontSize: 12,
		textTransform: "uppercase",
	},
	optionRow: {
		gap: 8,
	},
	overlay: {
		...StyleSheet.absoluteFillObject,
		padding: 16,
		paddingTop: 56,
	},
	panel: {
		alignSelf: "stretch",
		backgroundColor: "rgba(6, 17, 27, 0.84)",
		borderColor: "rgba(125, 211, 252, 0.18)",
		borderRadius: 18,
		borderWidth: 1,
		gap: 16,
		maxWidth: 360,
		padding: 16,
	},
	primaryButton: {
		backgroundColor: "#38bdf8",
	},
	primaryButtonText: {
		color: "#062033",
	},
	screen: {
		backgroundColor: "#08131d",
		flex: 1,
	},
	secondaryButton: {
		backgroundColor: "rgba(255,255,255,0.08)",
		flexBasis: 88,
		flexGrow: 0,
	},
	subtitle: {
		color: "#8fa7ba",
		fontSize: 13,
	},
	title: {
		color: "#f3f7fb",
		fontSize: 20,
		fontWeight: "700",
	},
} satisfies Record<string, ViewStyle | any>)
