#pragma once

#include <functional>
#include <chrono>
#include <memory>
#include <mutex>
#include <unordered_map>

#include "RNSkView.h"

namespace RNSkia {
class DrawingCtx;
}

namespace margelo::nitro::RNSkiaYoga {

class YogaNode;

struct RNSkYogaProfilingSample {
	double avgDrawMs = 0.0;
	double avgPresentMs = 0.0;
	double maxDrawMs = 0.0;
	double maxPresentMs = 0.0;
	double sampleDurationMs = 0.0;
	double frames = 0.0;
};

class RNSkYogaRenderer final : public RNSkia::RNSkRenderer {
public:
	RNSkYogaRenderer(
		std::function<void()> requestRedraw,
		std::shared_ptr<RNSkia::RNSkPlatformContext> context);

	void renderImmediate(
		std::shared_ptr<RNSkia::RNSkCanvasProvider> canvasProvider
	) override;

	void setRoot(const std::shared_ptr<YogaNode>& root);
	double consumeLastDrawDurationMs();
	void setDebugFps(double fps);

private:
	std::mutex _mutex;
	std::mutex _drawTimingMutex;
	std::mutex _fpsMutex;
	double _lastDrawDurationMs = 0.0;
	double _debugFps = 0.0;
	std::shared_ptr<RNSkia::RNSkPlatformContext> _platformContext;
	std::shared_ptr<YogaNode> _root;
};

class RNSkYogaView : public RNSkia::RNSkView {
public:
	RNSkYogaView(
		std::shared_ptr<RNSkia::RNSkPlatformContext> context,
		std::shared_ptr<RNSkia::RNSkCanvasProvider> canvasProvider);

	void requestRender();
	void setAnimating(bool animating);
	void setRoot(const std::shared_ptr<YogaNode>& root);
	void setJsiProperties(
		std::unordered_map<std::string, RNJsi::ViewProperty>& props) override;
	void setSchedulerCallbacks(
		std::function<void()> startScheduler,
		std::function<void()> stopScheduler
	);
	RNSkYogaProfilingSample consumeProfilingSample();

	bool onFrame();

private:
	void recordFrameMetrics(double drawMs, double presentMs);

	std::mutex _stateMutex;
	std::mutex _profilingMutex;
	bool _animating = false;
	bool _dirty = true;
	bool _schedulerRunning = false;
	bool _profilingSampleActive = false;
	double _profilingDrawTotalMs = 0.0;
	double _profilingPresentTotalMs = 0.0;
	double _profilingMaxDrawMs = 0.0;
	double _profilingMaxPresentMs = 0.0;
	double _profilingFrames = 0.0;
	double _smoothedFps = 0.0;
	bool _hasPreviousFrameStart = false;
	std::chrono::steady_clock::time_point _previousFrameStart;
	std::chrono::steady_clock::time_point _profilingSampleStart;
	std::function<void()> _startScheduler;
	std::function<void()> _stopScheduler;
};

} // namespace margelo::nitro::RNSkiaYoga
