#include "RNSkYogaView.hpp"

#include <algorithm>
#include <array>
#include <cmath>
#include <cstring>
#include <cstdio>
#include <utility>
#include <include/core/SkPaint.h>
#include <include/core/SkColor.h>
#include <include/core/SkRect.h>

#include "DrawingCtx.h"
#include "YogaNode.hpp"

namespace margelo::nitro::RNSkiaYoga {

namespace {

constexpr int kDigitWidth = 10;
constexpr int kDigitHeight = 16;
constexpr int kDigitThickness = 2;

constexpr std::array<std::array<bool, 7>, 10> kSevenSegmentDigits = {{
	{{true, true, true, true, true, true, false}},
	{{false, true, true, false, false, false, false}},
	{{true, true, false, true, true, false, true}},
	{{true, true, true, true, false, false, true}},
	{{false, true, true, false, false, true, true}},
	{{true, false, true, true, false, true, true}},
	{{true, false, true, true, true, true, true}},
	{{true, true, true, false, false, false, false}},
	{{true, true, true, true, true, true, true}},
	{{true, true, true, true, false, true, true}},
}};

void drawDigitSegments(
	SkCanvas* canvas,
	int digit,
	float x,
	float y,
	const SkPaint& onPaint,
	const SkPaint& offPaint)
{
	if (canvas == nullptr) {
		return;
	}

	const auto drawSegment = [&](int index, const SkRect& rect) {
		if (digit >= 0 && digit <= 9 && kSevenSegmentDigits[digit][index]) {
			canvas->drawRect(rect, onPaint);
		} else {
			canvas->drawRect(rect, offPaint);
		}
	};

	const float w = static_cast<float>(kDigitWidth);
	const float h = static_cast<float>(kDigitHeight);
	const float t = static_cast<float>(kDigitThickness);
	const float halfH = h * 0.5f;

	// Top
	drawSegment(0, SkRect::MakeXYWH(x + t, y, w - (2.0f * t), t));
	// Upper right
	drawSegment(1, SkRect::MakeXYWH(x + w - t, y + t, t, halfH - t));
	// Lower right
	drawSegment(2, SkRect::MakeXYWH(x + w - t, y + halfH, t, halfH - t));
	// Bottom
	drawSegment(3, SkRect::MakeXYWH(x + t, y + h - t, w - (2.0f * t), t));
	// Lower left
	drawSegment(4, SkRect::MakeXYWH(x, y + halfH, t, halfH - t));
	// Upper left
	drawSegment(5, SkRect::MakeXYWH(x, y + t, t, halfH - t));
	// Middle
	drawSegment(6, SkRect::MakeXYWH(x + t, y + halfH - (t * 0.5f), w - (2.0f * t), t));
}

} // namespace

RNSkYogaRenderer::RNSkYogaRenderer(
	std::function<void()> requestRedraw,
	std::shared_ptr<RNSkia::RNSkPlatformContext> context)
	: RNSkia::RNSkRenderer(std::move(requestRedraw))
	, _platformContext(std::move(context))
{
}

void RNSkYogaRenderer::renderImmediate(
	std::shared_ptr<RNSkia::RNSkCanvasProvider> canvasProvider)
{
	std::shared_ptr<YogaNode> root;
	{
		std::lock_guard<std::mutex> lock(_mutex);
		root = _root;
	}

	const auto pixelDensity =
		_platformContext != nullptr ? _platformContext->getPixelDensity() : 1.0f;

	canvasProvider->renderToCanvas([this, root = std::move(root), pixelDensity](
											SkCanvas* canvas) {
		auto drawStart = std::chrono::steady_clock::now();
		canvas->clear(SK_ColorTRANSPARENT);
		canvas->save();
		canvas->scale(pixelDensity, pixelDensity);

		if (root != nullptr) {
			RNSkia::DrawingCtx ctx(canvas);
			root->renderToContext(ctx);
		}

		canvas->restore();

		if (getShowDebugOverlays()) {
			double fps = 0.0;
			{
				std::lock_guard<std::mutex> fpsLock(_fpsMutex);
				fps = _debugFps;
			}

			canvas->save();
			canvas->scale(pixelDensity, pixelDensity);

			SkPaint badgePaint;
			badgePaint.setColor(SkColorSetARGB(185, 8, 19, 29));
			badgePaint.setStyle(SkPaint::kFill_Style);

			SkPaint digitOnPaint;
			digitOnPaint.setColor(SK_ColorWHITE);
			digitOnPaint.setAntiAlias(true);
			digitOnPaint.setStyle(SkPaint::kFill_Style);

			SkPaint digitOffPaint;
			digitOffPaint.setColor(SkColorSetARGB(50, 219, 231, 240));
			digitOffPaint.setAntiAlias(true);
			digitOffPaint.setStyle(SkPaint::kFill_Style);

			SkPaint accentPaint;
			accentPaint.setColor(SkColorSetARGB(255, 125, 211, 252));
			accentPaint.setAntiAlias(true);
			accentPaint.setStyle(SkPaint::kFill_Style);

			const float paddingX = 8.0f;
			const float paddingY = 4.0f;
			const float digitSpacing = 3.0f;
			const float badgeWidth = 90.0f;
			const float badgeHeight = 24.0f;
			const float badgeX = 12.0f;
			const float badgeY = 12.0f;

			int fpsRounded = -1;
			if (fps > 0.0 && std::isfinite(fps)) {
				fpsRounded = std::clamp(static_cast<int>(std::lround(fps)), 0, 999);
			}

			int hundreds = -1;
			int tens = -1;
			int ones = -1;
			if (fpsRounded >= 0) {
				hundreds = fpsRounded / 100;
				tens = (fpsRounded / 10) % 10;
				ones = fpsRounded % 10;
				if (hundreds == 0) {
					hundreds = -1;
					if (tens == 0) {
						tens = -1;
					}
				}
			}

			const float digitsX = badgeX + paddingX;
			const float digitsY = badgeY + paddingY;

			canvas->drawRoundRect(
				SkRect::MakeXYWH(badgeX, badgeY, badgeWidth, badgeHeight),
				8.0f,
				8.0f,
				badgePaint);

			drawDigitSegments(
				canvas,
				hundreds,
				digitsX,
				digitsY,
				digitOnPaint,
				digitOffPaint);
			drawDigitSegments(
				canvas,
				tens,
				digitsX + static_cast<float>(kDigitWidth) + digitSpacing,
				digitsY,
				digitOnPaint,
				digitOffPaint);
			drawDigitSegments(
				canvas,
				ones,
				digitsX + (static_cast<float>(kDigitWidth) + digitSpacing) * 2.0f,
				digitsY,
				digitOnPaint,
				digitOffPaint);

			const float barX = badgeX + badgeWidth - 22.0f;
			const float barBottom = badgeY + badgeHeight - 4.0f;
			canvas->drawRect(
				SkRect::MakeXYWH(barX, barBottom - 4.0f, 3.0f, 4.0f),
				accentPaint);
			canvas->drawRect(
				SkRect::MakeXYWH(barX + 5.0f, barBottom - 8.0f, 3.0f, 8.0f),
				accentPaint);
			canvas->drawRect(
				SkRect::MakeXYWH(barX + 10.0f, barBottom - 12.0f, 3.0f, 12.0f),
				accentPaint);

			canvas->restore();
		}

		auto drawEnd = std::chrono::steady_clock::now();
		const auto drawMs = std::chrono::duration<double, std::milli>(
			drawEnd - drawStart)
							 .count();
		std::lock_guard<std::mutex> lock(_drawTimingMutex);
		_lastDrawDurationMs = drawMs;
	});
}

void RNSkYogaRenderer::setRoot(const std::shared_ptr<YogaNode>& root)
{
	std::lock_guard<std::mutex> lock(_mutex);
	_root = root;
}

double RNSkYogaRenderer::consumeLastDrawDurationMs()
{
	std::lock_guard<std::mutex> lock(_drawTimingMutex);
	return std::exchange(_lastDrawDurationMs, 0.0);
}

void RNSkYogaRenderer::setDebugFps(double fps)
{
	std::lock_guard<std::mutex> lock(_fpsMutex);
	_debugFps = fps;
}

RNSkYogaView::RNSkYogaView(
	std::shared_ptr<RNSkia::RNSkPlatformContext> context,
	std::shared_ptr<RNSkia::RNSkCanvasProvider> canvasProvider)
	: RNSkia::RNSkView(
			context,
			std::move(canvasProvider),
			std::make_shared<RNSkYogaRenderer>(
				[this]() { requestRedraw(); },
				std::move(context)))
{
}

void RNSkYogaView::requestRender()
{
	std::function<void()> callback;
	{
		std::lock_guard<std::mutex> lock(_stateMutex);
		_dirty = true;
		if (!_schedulerRunning) {
			_schedulerRunning = true;
			callback = _startScheduler;
		}
	}

	if (callback) {
		callback();
	}
}

void RNSkYogaView::setAnimating(bool animating)
{
	std::function<void()> callback;
	{
		std::lock_guard<std::mutex> lock(_stateMutex);
		_animating = animating;
		if ((_animating || _dirty) && !_schedulerRunning) {
			_schedulerRunning = true;
			callback = _startScheduler;
		}
	}

	if (callback) {
		callback();
	}
}

void RNSkYogaView::setRoot(const std::shared_ptr<YogaNode>& root)
{
	std::static_pointer_cast<RNSkYogaRenderer>(getRenderer())->setRoot(root);
	requestRender();
}

void RNSkYogaView::setJsiProperties(
	std::unordered_map<std::string, RNJsi::ViewProperty>& props)
{
	(void)props;
}

void RNSkYogaView::setSchedulerCallbacks(
	std::function<void()> startScheduler,
	std::function<void()> stopScheduler)
{
	std::lock_guard<std::mutex> lock(_stateMutex);
	_startScheduler = std::move(startScheduler);
	_stopScheduler = std::move(stopScheduler);
}

bool RNSkYogaView::onFrame()
{
	auto frameStart = std::chrono::steady_clock::now();
	{
		std::lock_guard<std::mutex> lock(_profilingMutex);
		if (_hasPreviousFrameStart) {
			const auto frameDeltaMs = std::chrono::duration<double, std::milli>(
				frameStart - _previousFrameStart)
								 .count();
			if (frameDeltaMs > 0.0) {
				const auto instantFps = 1000.0 / frameDeltaMs;
				if (_smoothedFps <= 0.0) {
					_smoothedFps = instantFps;
				} else {
					_smoothedFps = (_smoothedFps * 0.85) + (instantFps * 0.15);
				}
			}
		}
		_previousFrameStart = frameStart;
		_hasPreviousFrameStart = true;
	}

	auto renderer = std::static_pointer_cast<RNSkYogaRenderer>(getRenderer());
	renderer->setDebugFps(_smoothedFps);

	{
		std::lock_guard<std::mutex> lock(_stateMutex);
		if (!_dirty && !_animating) {
			_schedulerRunning = false;
			return false;
		}
		_dirty = false;
	}

	redraw();
	auto frameEnd = std::chrono::steady_clock::now();

	auto drawMs = renderer->consumeLastDrawDurationMs();
	const auto frameMs = std::chrono::duration<double, std::milli>(
		frameEnd - frameStart)
						 .count();
	if (drawMs < 0.0) {
		drawMs = 0.0;
	}
	if (drawMs > frameMs) {
		drawMs = frameMs;
	}
	const auto presentMs = std::max(0.0, frameMs - drawMs);
	recordFrameMetrics(drawMs, presentMs);

	std::function<void()> stopCallback;
	bool shouldContinue = false;
	{
		std::lock_guard<std::mutex> lock(_stateMutex);
		shouldContinue = _dirty || _animating;
		if (!shouldContinue) {
			_schedulerRunning = false;
			stopCallback = _stopScheduler;
		}
	}

	if (!shouldContinue && stopCallback) {
		stopCallback();
	}

	return shouldContinue;
}

void RNSkYogaView::recordFrameMetrics(double drawMs, double presentMs)
{
	std::lock_guard<std::mutex> lock(_profilingMutex);
	const auto now = std::chrono::steady_clock::now();
	if (!_profilingSampleActive) {
		_profilingSampleActive = true;
		_profilingSampleStart = now;
	}

	_profilingFrames += 1.0;
	_profilingDrawTotalMs += drawMs;
	_profilingPresentTotalMs += presentMs;
	_profilingMaxDrawMs = std::max(_profilingMaxDrawMs, drawMs);
	_profilingMaxPresentMs = std::max(_profilingMaxPresentMs, presentMs);
}

RNSkYogaProfilingSample RNSkYogaView::consumeProfilingSample()
{
	std::lock_guard<std::mutex> lock(_profilingMutex);
	RNSkYogaProfilingSample sample;

	if (_profilingSampleActive) {
		const auto now = std::chrono::steady_clock::now();
		sample.sampleDurationMs = std::chrono::duration<double, std::milli>(
			now - _profilingSampleStart)
								 .count();
	}

	sample.frames = _profilingFrames;
	if (_profilingFrames > 0.0) {
		sample.avgDrawMs = _profilingDrawTotalMs / _profilingFrames;
		sample.avgPresentMs = _profilingPresentTotalMs / _profilingFrames;
		sample.maxDrawMs = _profilingMaxDrawMs;
		sample.maxPresentMs = _profilingMaxPresentMs;
	}

	_profilingSampleActive = false;
	_profilingDrawTotalMs = 0.0;
	_profilingPresentTotalMs = 0.0;
	_profilingMaxDrawMs = 0.0;
	_profilingMaxPresentMs = 0.0;
	_profilingFrames = 0.0;

	return sample;
}

} // namespace margelo::nitro::RNSkiaYoga
