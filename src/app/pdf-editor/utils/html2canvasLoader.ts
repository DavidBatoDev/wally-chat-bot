/**
 * Utility for loading html2canvas dynamically with proper error handling
 * This handles the common Next.js chunking issues with html2canvas
 * and works with both Webpack and Turbopack
 */

let html2canvasModule: any = null;

export async function loadHtml2Canvas(): Promise<any> {
  // Return cached module if already loaded
  if (html2canvasModule) {
    return html2canvasModule;
  }

  try {
    // First attempt: Standard dynamic import with better error handling
    console.log('Loading html2canvas module...');
    
    // For Turbopack compatibility, use a more explicit import
    const module = await import('html2canvas');
    html2canvasModule = module.default || module;
    
    if (typeof html2canvasModule === 'function') {
      console.log('html2canvas loaded successfully');
      return html2canvasModule;
    } else {
      throw new Error('html2canvas module did not export a function');
    }
  } catch (error) {
    console.warn('Primary html2canvas import failed, trying alternative method:', error);
    
    try {
      // Second attempt: Check if already available globally
      if (typeof window !== 'undefined') {
        const html2canvas = (window as any).html2canvas;
        if (html2canvas && typeof html2canvas === 'function') {
          html2canvasModule = html2canvas;
          console.log('html2canvas found in global scope');
          return html2canvasModule;
        }
      }
      
      // Third attempt: Load from CDN as fallback
      console.log('Loading html2canvas from CDN...');
      await loadHtml2CanvasFromCDN();
      html2canvasModule = (window as any).html2canvas;
      
      if (typeof html2canvasModule === 'function') {
        console.log('html2canvas loaded from CDN successfully');
        return html2canvasModule;
      } else {
        throw new Error('CDN loaded html2canvas is not a function');
      }
    } catch (fallbackError) {
      console.error('All html2canvas loading methods failed:', fallbackError);
      throw new Error('Failed to load html2canvas. Please refresh the page and try again.');
    }
  }
}

async function loadHtml2CanvasFromCDN(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Cannot load CDN script on server side'));
      return;
    }

    // Check if already loaded
    if ((window as any).html2canvas) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    script.integrity = 'sha512-dK/Gt9eK0RgI9j6+xwBeFPdyMAHXfNZWy/hxGT5j4K4t2xBQXXYp5Z2gXD8JDGb5PGVb6FPWo5wPa5YyHaGNUA==';
    script.crossOrigin = 'anonymous';
    script.referrerPolicy = 'no-referrer';
    
    script.onload = () => {
      if ((window as any).html2canvas && typeof (window as any).html2canvas === 'function') {
        resolve();
      } else {
        reject(new Error('html2canvas not available after CDN load'));
      }
    };
    
    script.onerror = () => reject(new Error('Failed to load html2canvas from CDN'));
    
    document.head.appendChild(script);
  });
}

// Preload function that can be called early in the app lifecycle
export function preloadHtml2Canvas(): void {
  if (typeof window !== 'undefined') {
    // Start loading in the background
    loadHtml2Canvas().catch(error => {
      console.warn('Preload of html2canvas failed:', error);
    });
  }
}
