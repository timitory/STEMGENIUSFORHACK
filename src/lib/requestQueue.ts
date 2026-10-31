/**
 * Request Queue & Rate Limiting Utility
 * Prevents worker resource exhaustion by controlling concurrent requests
 */

interface QueuedRequest<T> {
  id: string;
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  priority: number;
}

class RequestQueue {
  private queue: QueuedRequest<any>[] = [];
  private activeRequests = 0;
  private maxConcurrent = 2; // 2 concurrent requests per user
  private requestMap = new Map<string, QueuedRequest<any>>();

  setMaxConcurrent(max: number) {
    this.maxConcurrent = Math.max(1, Math.min(5, max)); // Clamp between 1-5
  }

  /**
   * Enqueue a request with deduplication
   * Prevents duplicate requests if same request already pending
   */
  async enqueue<T>(
    requestId: string,
    fn: () => Promise<T>,
    priority = 0
  ): Promise<T> {
    // Check if request already queued
    if (this.requestMap.has(requestId)) {
      console.warn(`Duplicate request detected: ${requestId}, returning existing request`);
      return this.requestMap.get(requestId)!.fn();
    }

    return new Promise<T>((resolve, reject) => {
      const request: QueuedRequest<T> = {
        id: requestId,
        fn,
        resolve,
        reject,
        priority,
      };

      this.requestMap.set(requestId, request);
      this.queue.push(request);
      this.queue.sort((a, b) => b.priority - a.priority); // Higher priority first
      
      this.processQueue();
    });
  }

  private async processQueue() {
    while (this.activeRequests < this.maxConcurrent && this.queue.length > 0) {
      const request = this.queue.shift();
      if (!request) continue;

      this.activeRequests++;

      try {
        const result = await request.fn();
        request.resolve(result);
      } catch (error) {
        request.reject(error instanceof Error ? error : new Error(String(error)));
      } finally {
        this.activeRequests--;
        this.requestMap.delete(request.id);
        this.processQueue(); // Process next in queue
      }
    }
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  getActiveCount(): number {
    return this.activeRequests;
  }
}

/**
 * Rate Limiter with sliding window
 * Tracks requests per user and enforces limits
 */
class RateLimiter {
  private requestTimestamps = new Map<string, number[]>();
  private windowMs = 60000; // 1 minute window
  private maxRequests = 10; // 10 requests per window

  /**
   * Check if request allowed, returns true if within limit
   */
  isAllowed(userId: string): boolean {
    const now = Date.now();
    const key = `user_${userId}`;
    
    // Get existing timestamps
    let timestamps = this.requestTimestamps.get(key) || [];
    
    // Remove old timestamps outside window
    timestamps = timestamps.filter(ts => now - ts < this.windowMs);
    
    // Check if limit exceeded
    if (timestamps.length >= this.maxRequests) {
      return false;
    }
    
    // Add current request
    timestamps.push(now);
    this.requestTimestamps.set(key, timestamps);
    
    return true;
  }

  /**
   * Get remaining requests for user
   */
  getRemainingRequests(userId: string): number {
    const key = `user_${userId}`;
    const timestamps = this.requestTimestamps.get(key) || [];
    const now = Date.now();
    
    const valid = timestamps.filter(ts => now - ts < this.windowMs);
    return Math.max(0, this.maxRequests - valid.length);
  }

  /**
   * Get time until next request allowed (in ms)
   */
  getResetTime(userId: string): number {
    const key = `user_${userId}`;
    const timestamps = this.requestTimestamps.get(key) || [];
    
    if (timestamps.length === 0) return 0;
    
    const oldestRequest = timestamps[0];
    const now = Date.now();
    const resetTime = oldestRequest + this.windowMs - now;
    
    return Math.max(0, resetTime);
  }

  /**
   * Configure rate limit
   */
  configure(windowMs: number, maxRequests: number) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }
}

/**
 * File size validator with limits
 */
class FileSizeValidator {
  private limits: Record<string, number> = {
    pdf: 50 * 1024 * 1024, // 50MB
    txt: 10 * 1024 * 1024, // 10MB
    docx: 50 * 1024 * 1024, // 50MB
    doc: 50 * 1024 * 1024, // 50MB
    image: 5 * 1024 * 1024, // 5MB
  };

  /**
   * Validate file size based on type
   */
  validate(file: File): { valid: boolean; error?: string } {
    const ext = file.name.split('.').pop()?.toLowerCase();
    const fileType = this.getFileType(ext);
    const limit = this.limits[fileType];

    if (file.size > limit) {
      const limitMB = (limit / 1024 / 1024).toFixed(1);
      const sizeMB = (file.size / 1024 / 1024).toFixed(1);
      return {
        valid: false,
        error: `File too large. Max ${limitMB}MB, got ${sizeMB}MB`,
      };
    }

    return { valid: true };
  }

  private getFileType(ext?: string): string {
    if (!ext) return 'txt';
    if (['pdf'].includes(ext)) return 'pdf';
    if (['txt', 'md'].includes(ext)) return 'txt';
    if (['docx', 'doc', 'odt'].includes(ext)) return 'docx';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
    return 'txt'; // Default
  }
}

/**
 * Request deduplicator using md5 hash
 * Prevents sending identical requests multiple times
 */
class RequestDeduplicator {
  private requestCache = new Map<string, { result: any; timestamp: number }>();
  private cacheTimeMs = 2000; // Keep cache for 2 seconds

  /**
   * Generate unique key from request data
   */
  private generateKey(...args: any[]): string {
    try {
      return JSON.stringify(args).replace(/\s/g, '');
    } catch {
      return String(args);
    }
  }

  /**
   * Check if request is duplicate and store it if not
   */
  checkAndStore(hash: string): { isDuplicate: boolean } {
    const now = Date.now();
    const cached = this.requestCache.get(hash);
    
    if (cached && now - cached.timestamp < this.cacheTimeMs) {
      return { isDuplicate: true };
    }
    
    // Store the request
    this.requestCache.set(hash, {
      result: true,
      timestamp: now,
    });
    
    return { isDuplicate: false };
  }

  /**
   * Get cached result if available and not expired
   */
  getIfCached<T>(args: any[]): T | null {
    const key = this.generateKey(...args);
    const cached = this.requestCache.get(key);

    if (cached && Date.now() - cached.timestamp < this.cacheTimeMs) {
      return cached.result;
    }

    if (cached) {
      this.requestCache.delete(key);
    }

    return null;
  }

  /**
   * Cache a request result
   */
  cache<T>(args: any[], result: T): void {
    const key = this.generateKey(...args);
    this.requestCache.set(key, {
      result,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear expired cache entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.requestCache.entries()) {
      if (now - value.timestamp > this.cacheTimeMs * 2) {
        this.requestCache.delete(key);
      }
    }
  }
}

// Export singleton instances
export const requestQueue = new RequestQueue();
export const rateLimiter = new RateLimiter();
export const fileSizeValidator = new FileSizeValidator();
export const requestDeduplicator = new RequestDeduplicator();

// Configure defaults (can be overridden based on environment)
export function configureResourceLimits(config: {
  maxConcurrent?: number;
  rateLimitWindow?: number;
  rateLimitMax?: number;
  fileSizeLimits?: Record<string, number>;
}) {
  if (config.maxConcurrent !== undefined) {
    requestQueue.setMaxConcurrent(config.maxConcurrent);
  }
  if (config.rateLimitWindow !== undefined && config.rateLimitMax !== undefined) {
    rateLimiter.configure(config.rateLimitWindow, config.rateLimitMax);
  }
  if (config.fileSizeLimits) {
    Object.assign(fileSizeValidator['limits'], config.fileSizeLimits);
  }
}
