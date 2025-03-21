/**
 * A utility to enforce rate limits for API calls with retry mechanisms
 */

// Configuration for rate limiting and retries
const DEFAULT_RETRY_DELAY = 5000; // 5 seconds
const DEFAULT_MAX_RETRIES = 3;
const ENABLE_DEBUG_LOGGING = true; // Set to true for detailed debug logs

// Queue for managing API calls
class RequestQueue {
  private queue: Array<{
    fn: () => Promise<any>;
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
    retries: number;
  }> = [];
  private processing = false;
  private requestsPerSecond: number;
  private minDelayMs: number;
  private lastRequestTime = 0;
  private maxRetries: number;

  constructor(requestsPerSecond = 1, maxRetries = DEFAULT_MAX_RETRIES) {
    this.requestsPerSecond = requestsPerSecond;
    this.minDelayMs = 1000 / requestsPerSecond;
    this.maxRetries = maxRetries;
  }

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        fn,
        resolve,
        reject,
        retries: 0
      });

      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  private async processQueue() {
    if (this.queue.length === 0) {
      this.processing = false;
      return;
    }

    this.processing = true;
    
    // Calculate delay to respect rate limit
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const delay = Math.max(0, this.minDelayMs - timeSinceLastRequest);
    
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    // Process next request
    const request = this.queue.shift();
    if (request) {
      const { fn, resolve, reject, retries } = request;
      
      // Execute the request
      this.lastRequestTime = Date.now();
      try {
        if (ENABLE_DEBUG_LOGGING) {
          console.log(`[Rate Limit] Executing request (retry attempt: ${retries})`);
        }
        
        const result = await fn();
        
        if (ENABLE_DEBUG_LOGGING) {
          console.log(`[Rate Limit] Request successful`);
        }
        
        resolve(result);
      } catch (error: any) {
        // Enhanced error logging
        if (ENABLE_DEBUG_LOGGING) {
          console.error(`[Rate Limit] Request failed with error:`, {
            status: error?.response?.status,
            message: error?.message,
            responseData: error?.response?.data,
            headers: error?.response?.headers
          });
        }
        
        // Check if it's a rate limit error (HTTP 429 or related messages)
        const isRateLimitError = 
          error?.response?.status === 429 || 
          (error.message && (
            error.message.includes('429') || 
            error.message.toLowerCase().includes('rate limit') ||
            error.message.toLowerCase().includes('too many requests')
          )) ||
          (error?.response?.data && 
            typeof error.response.data === 'string' && 
            error.response.data.toLowerCase().includes('rate limit'));
        
        // If it's a rate limit error and we haven't exceeded max retries
        if (isRateLimitError && retries < this.maxRetries) {
          // Calculate exponential backoff delay with jitter
          const retryAfterHeader = error?.response?.headers?.['retry-after'];
          const baseDelayMs = retryAfterHeader 
            ? parseInt(retryAfterHeader, 10) * 1000 
            : DEFAULT_RETRY_DELAY;
            
          // Apply exponential backoff: delay increases with each retry
          const exponentialDelay = baseDelayMs * Math.pow(2, retries);
          
          // Add random jitter to prevent all retries happening at the same time
          const jitter = Math.random() * 1000;
          const finalDelay = exponentialDelay + jitter;
          
          console.warn(`[Rate Limit] Hit (429 or similar), retrying (${retries + 1}/${this.maxRetries}) after ${Math.round(finalDelay/1000)}s delay...`);
          
          // Add the request back to the queue with increased retry count
          setTimeout(() => {
            this.queue.unshift({
              fn,
              resolve,
              reject,
              retries: retries + 1
            });
          }, finalDelay);
        } else {
          // If not a rate limit error or exceeded retries, reject the promise
          if (isRateLimitError) {
            console.error(`[Rate Limit] Max retries (${this.maxRetries}) exceeded for rate limit error. Giving up.`);
          } else {
            console.error(`[Rate Limit] Non-rate-limit error occurred. Not retrying.`);
          }
          reject(error);
        }
      }
    }
    
    // Continue processing
    setTimeout(() => this.processQueue(), 0);
  }
}

// Create a singleton RequestQueue instance
const apiQueue = new RequestQueue(1, 3); // 1 request per second, max 3 retries

/**
 * Wrap a function with rate limiting and automatic retries for rate limit errors
 */
export function withRateLimit<T>(fn: () => Promise<T>): Promise<T> {
  return apiQueue.add(fn);
}