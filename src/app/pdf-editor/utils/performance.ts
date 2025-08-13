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

// Batched update utility for multiple operations
export class BatchedUpdater {
  private batchQueue: (() => void)[] = [];
  private rafId: number | null = null;

  addToBatch(updateFn: () => void) {
    this.batchQueue.push(updateFn);
    
    if (!this.rafId) {
      this.rafId = requestAnimationFrame(() => {
        this.processBatch();
      });
    }
  }

  private processBatch() {
    const currentBatch = [...this.batchQueue];
    this.batchQueue = [];
    this.rafId = null;

    // Execute all batched updates
    currentBatch.forEach(updateFn => updateFn());
  }

  flush() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.processBatch();
    }
  }
}

// High-performance throttle specifically designed for drag operations
export function dragThrottle<T extends (...args: any[]) => any>(
  func: T,
  options: { fps?: number; immediate?: boolean } = {}
): (...args: Parameters<T>) => void {
  const fps = options.fps || 60;
  const interval = 1000 / fps;
  const immediate = options.immediate ?? true;
  
  let lastCall = 0;
  let rafId: number | null = null;
  let lastArgs: Parameters<T> | null = null;

  return function (this: any, ...args: Parameters<T>) {
    lastArgs = args;
    const now = performance.now();

    if (immediate && now - lastCall >= interval) {
      func.apply(this, args);
      lastCall = now;
      return;
    }

    if (rafId) return;

    rafId = requestAnimationFrame(() => {
      const currentTime = performance.now();
      if (currentTime - lastCall >= interval && lastArgs) {
        func.apply(this, lastArgs);
        lastCall = currentTime;
      }
      rafId = null;
    });
  };
}

// Transform-based element positioning for smooth visual updates
export function applyTransform(elementId: string, deltaX: number, deltaY: number, scale: number = 1) {
  const element = document.querySelector(`[data-element-id="${elementId}"]`) as HTMLElement;
  if (element) {
    element.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${scale})`;
    element.style.zIndex = '1000'; // Ensure dragged elements appear on top
  }
}

export function clearTransform(elementId: string) {
  const element = document.querySelector(`[data-element-id="${elementId}"]`) as HTMLElement;
  if (element) {
    element.style.transform = '';
    element.style.zIndex = '';
  }
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
