import { useRef, useCallback, useEffect } from "react";

interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  lastFrameTime: number;
  frameCount: number;
}

export const usePerformanceMonitor = () => {
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const metricsRef = useRef<PerformanceMetrics>({
    fps: 0,
    frameTime: 0,
    lastFrameTime: 0,
    frameCount: 0,
  });

  const updateMetrics = useCallback(() => {
    const now = performance.now();
    const deltaTime = now - lastTimeRef.current;

    frameCountRef.current++;

    if (deltaTime >= 1000) {
      // Update every second
      const fps = Math.round((frameCountRef.current * 1000) / deltaTime);
      const frameTime = deltaTime / frameCountRef.current;

      metricsRef.current = {
        fps,
        frameTime,
        lastFrameTime: now,
        frameCount: frameCountRef.current,
      };

      // Reset counters
      frameCountRef.current = 0;
      lastTimeRef.current = now;

      // Log performance in development
      if (process.env.NODE_ENV === "development") {
        console.log("Performance Metrics:", {
          fps: `${fps} FPS`,
          frameTime: `${frameTime.toFixed(2)}ms`,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }, []);

  const startMonitoring = useCallback(() => {
    frameCountRef.current = 0;
    lastTimeRef.current = performance.now();
  }, []);

  const getMetrics = useCallback(() => {
    return { ...metricsRef.current };
  }, []);

  // Auto-update metrics every frame
  useEffect(() => {
    let animationId: number;

    const updateLoop = () => {
      updateMetrics();
      animationId = requestAnimationFrame(updateLoop);
    };

    animationId = requestAnimationFrame(updateLoop);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [updateMetrics]);

  return {
    startMonitoring,
    getMetrics,
    updateMetrics,
  };
};
