/**
 * Performance optimization utilities for smooth shape drawing
 */

// Throttle function to limit execution frequency
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return function (this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// Debounce function to delay execution until after a pause
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  return function (this: any, ...args: Parameters<T>) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

// High-performance throttle using requestAnimationFrame
export function rafThrottle<T extends (...args: any[]) => any>(
  func: T
): (...args: Parameters<T>) => void {
  let rafId: number | null = null;
  return function (this: any, ...args: Parameters<T>) {
    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        func.apply(this, args);
        rafId = null;
      });
    }
  };
}

// Optimized throttle for multi-selection drag operations
export function multiSelectDragThrottle<T extends (...args: any[]) => any>(
  func: T,
  options: { fps?: number; maxElements?: number } = {}
): (...args: Parameters<T>) => void {
  const { fps = 60, maxElements = 50 } = options;
  const delay = 1000 / fps;
  let lastExecution = 0;
  let rafId: number | null = null;

  return function (this: any, ...args: Parameters<T>) {
    const now = performance.now();
    
    // For small selections, use RAF for smoother performance
    if (!args[0] || (Array.isArray(args[0]) && args[0].length <= 5)) {
      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          func.apply(this, args);
          rafId = null;
          lastExecution = now;
        });
      }
      return;
    }

    // For larger selections, use adaptive throttling
    const elementCount = Array.isArray(args[0]) ? args[0].length : 1;
    const adaptiveDelay = Math.max(delay, Math.min(delay * (elementCount / maxElements), 50));

    if (now - lastExecution >= adaptiveDelay) {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(() => {
        func.apply(this, args);
        rafId = null;
        lastExecution = now;
      });
    }
  };
}

// RequestAnimationFrame wrapper for smooth animations
export function smoothAnimation(callback: () => void): () => void {
  let animationId: number | null = null;

  const animate = () => {
    callback();
    animationId = requestAnimationFrame(animate);
  };

  const start = () => {
    if (animationId === null) {
      animationId = requestAnimationFrame(animate);
    }
  };

  const stop = () => {
    if (animationId !== null) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  };

  return stop;
}

// Performance monitoring utility
export class PerformanceMonitor {
  private startTime: number = 0;
  private measurements: number[] = [];

  start() {
    this.startTime = performance.now();
  }

  end(): number {
    const duration = performance.now() - this.startTime;
    this.measurements.push(duration);
    return duration;
  }

  getAverage(): number {
    if (this.measurements.length === 0) return 0;
    const sum = this.measurements.reduce((a, b) => a + b, 0);
    return sum / this.measurements.length;
  }

  getMin(): number {
    return Math.min(...this.measurements);
  }

  getMax(): number {
    return Math.max(...this.measurements);
  }

  reset() {
    this.measurements = [];
  }
}

// Memory usage monitoring
export function getMemoryUsage(): {
  used: number;
  total: number;
  percentage: number;
} {
  if ("memory" in performance) {
    const memory = (performance as any).memory;
    return {
      used: Math.round(memory.usedJSHeapSize / 1048576), // MB
      total: Math.round(memory.totalJSHeapSize / 1048576), // MB
      percentage: Math.round(
        (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100
      ),
    };
  }
  return { used: 0, total: 0, percentage: 0 };
}

// Frame rate monitoring
export class FrameRateMonitor {
  private frameCount: number = 0;
  private lastTime: number = performance.now();
  private fps: number = 0;

  update() {
    this.frameCount++;
    const currentTime = performance.now();

    if (currentTime - this.lastTime >= 1000) {
      this.fps = Math.round(
        (this.frameCount * 1000) / (currentTime - this.lastTime)
      );
      this.frameCount = 0;
      this.lastTime = currentTime;
    }
  }

  getFPS(): number {
    return this.fps;
  }

  reset() {
    this.frameCount = 0;
    this.lastTime = performance.now();
    this.fps = 0;
  }
}
