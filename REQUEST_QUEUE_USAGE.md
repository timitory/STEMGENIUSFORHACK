# Request Queue & Rate Limiting - Developer Guide

## Overview

The `src/lib/requestQueue.ts` module provides utilities to prevent resource exhaustion and manage concurrent requests efficiently.

## Components

### 1. RequestQueue
Manages request concurrency with per-user limits.

**Default Settings**:
- Max concurrent requests per user: 2
- Max requests per second: 5
- Priority levels: Not yet implemented

**Usage**:

```typescript
import { requestQueue } from '@/lib/requestQueue';

// Basic usage
const requestId = `unique_${Date.now()}`;
await requestQueue.enqueue(requestId, async () => {
  // Heavy operation here
  const result = await supabase.functions.invoke('generate-quiz', { body });
  return result;
});
```

**Configuration**:

```typescript
// Configure max concurrent requests (1-5)
requestQueue.configure({ maxConcurrent: 3 });

// Get queue status
const status = requestQueue.getQueueStatus();
console.log(`Pending: ${status.pending}, Active: ${status.active}`);
```

### 2. RateLimiter
Implements sliding window rate limiting per user.

**Default Settings**:
- Window size: 60 seconds
- Max requests per window: 10
- Per user basis

**Usage**:

```typescript
import { rateLimiter } from '@/lib/requestQueue';

// Check if user can make a request
if (!rateLimiter.isAllowed(userId)) {
  const resetTime = rateLimiter.getResetTime(userId);
  toast.error(`Too many requests. Please wait ${Math.ceil(resetTime / 1000)}s`);
  return;
}

// Proceed with request...
```

**Configuration**:

```typescript
// Configure rate limits
rateLimiter.configure({
  requestsPerWindow: 20,  // 20 requests per window
  windowSize: 60000       // in 60 seconds
});

// Get remaining requests for user
const remaining = rateLimiter.getRemaining(userId);
console.log(`Requests remaining: ${remaining}`);

// Reset user's rate limit (admin use)
rateLimiter.resetUser(userId);
```

### 3. FileSizeValidator
Validates files before upload to prevent processing oversized files.

**Default Limits**:
- PDF: 50MB
- Text (.txt): 10MB
- Images (.jpg, .png, .gif, .webp): 5MB
- Documents (.doc, .docx): 25MB
- Presentations (.ppt, .pptx): 30MB

**Usage**:

```typescript
import { fileSizeValidator } from '@/lib/requestQueue';

const file = event.target.files[0];

// Validate file size
const validation = fileSizeValidator.validate(file);
if (!validation.valid) {
  toast.error(validation.error);
  return;
}

// File is safe to upload
```

**Configuration**:

```typescript
// Add custom file type limits
fileSizeValidator.addFileType('mp4', 500); // 500MB for video files

// Check if file type is registered
if (!fileSizeValidator.hasFileType('zip')) {
  fileSizeValidator.addFileType('zip', 100); // Add 100MB for ZIP
}
```

### 4. RequestDeduplicator
Prevents duplicate requests within a time window.

**Default Settings**:
- Deduplication window: 2 seconds
- Stores request hashes

**Usage**:

```typescript
import { requestDeduplicator } from '@/lib/requestQueue';

// Create a request hash (usually parameters + user ID)
const requestHash = `quiz_${subject}_${difficulty}_${userId}`;

// Check and store (prevents duplicate within 2s)
const dedupeResult = requestDeduplicator.checkAndStore(requestHash);

if (dedupeResult.isDuplicate) {
  toast.warning('This request was just submitted. Please wait a moment...');
  return;
}

// Proceed with request...
```

**Configuration**:

```typescript
// Change deduplication window (milliseconds)
requestDeduplicator.configure({ windowSize: 5000 }); // 5 seconds

// Clear all cached requests (rarely needed)
requestDeduplicator.clear();
```

## Complete Example: Optimized Quiz Generation

```typescript
const generateQuizOptimized = async () => {
  // Step 1: Check rate limit
  if (user && !rateLimiter.isAllowed(user.id)) {
    const resetTime = rateLimiter.getResetTime(user.id);
    toast.error(`Too many requests. Wait ${Math.ceil(resetTime / 1000)}s`);
    return;
  }

  // Step 2: Create unique request hash for deduplication
  const requestHash = `quiz_${subject}_${difficulty}_${numberOfQuestions}_${user?.id}`;
  const dedupeResult = requestDeduplicator.checkAndStore(requestHash);
  
  if (dedupeResult.isDuplicate) {
    toast.warning('This request was just submitted. Please wait...');
    return;
  }

  // Step 3: If uploading file, validate size
  if (quizFile) {
    const sizeValidation = fileSizeValidator.validate(quizFile);
    if (!sizeValidation.valid) {
      toast.error(sizeValidation.error);
      return;
    }
  }

  // Step 4: Enqueue the request with concurrency control
  const requestId = `quiz_${Date.now()}_${Math.random()}`;
  
  try {
    await requestQueue.enqueue(requestId, async () => {
      // This runs with max 2 concurrent requests per user
      const { data, error } = await supabase.functions.invoke('generate-quiz', {
        body: {
          subject,
          difficulty,
          numberOfQuestions,
          documentText: quizFile ? await quizFile.text() : undefined
        }
      });

      if (error) throw error;
      
      setQuestions(data.questions);
      startGame(data.questions);
    });
  } catch (error) {
    handleError(error, 'quiz generation');
  }
};
```

## Best Practices

### 1. Always Check Rate Limit First
```typescript
// ✅ GOOD
if (!rateLimiter.isAllowed(userId)) return;

// ❌ BAD
const result = await makeRequest(); // May exceed limit
```

### 2. Use Meaningful Request IDs
```typescript
// ✅ GOOD
const requestId = `pdf_quiz_${userId}_${fileHash}`;

// ❌ BAD
const requestId = `request_1`; // Not unique or meaningful
```

### 3. Validate Files Before Queueing
```typescript
// ✅ GOOD
const validation = fileSizeValidator.validate(file);
if (!validation.valid) throw new Error(validation.error);
await requestQueue.enqueue(...);

// ❌ BAD
await requestQueue.enqueue(...);
// Validation happens inside, wastes queue slot
```

### 4. Create Dedup Hash from Request Parameters
```typescript
// ✅ GOOD
const hash = `${subject}_${difficulty}_${questionCount}`;

// ❌ BAD
const hash = Math.random().toString(); // Not based on request
```

### 5. Handle Errors Gracefully
```typescript
// ✅ GOOD
try {
  await requestQueue.enqueue(...);
} catch (error) {
  if (error.message.includes('timeout')) {
    toast.error('Request took too long. Please try again.');
  } else {
    handleError(error);
  }
}

// ❌ BAD
await requestQueue.enqueue(...); // Unhandled errors
```

## Monitoring & Debugging

### Check Queue Status
```typescript
// Get current queue metrics
const status = requestQueue.getQueueStatus();
console.log({
  pending: status.pending,
  active: status.active,
  total: status.total,
  userQueues: status.userQueues
});
```

### Monitor Rate Limits
```typescript
// Check remaining requests for user
const remaining = rateLimiter.getRemaining(userId);
const resetTime = rateLimiter.getResetTime(userId);

console.log(`Requests remaining: ${remaining}`);
console.log(`Resets in: ${Math.ceil(resetTime / 1000)}s`);
```

### Debug Deduplication
```typescript
// Check if request was deduplicated
const dedupeResult = requestDeduplicator.checkAndStore(hash);
if (dedupeResult.isDuplicate) {
  console.log('Duplicate request detected');
  console.log('Last submission:', new Date(dedupeResult.lastSubmissionTime));
}
```

## Performance Tuning

### Adjust Concurrency Limits
```typescript
// For low-end servers: 1 concurrent request
requestQueue.configure({ maxConcurrent: 1 });

// For high-end servers: 5 concurrent requests  
requestQueue.configure({ maxConcurrent: 5 });
```

### Adjust Rate Limits
```typescript
// Strict: 5 requests per minute
rateLimiter.configure({
  requestsPerWindow: 5,
  windowSize: 60000
});

// Relaxed: 30 requests per minute
rateLimiter.configure({
  requestsPerWindow: 30,
  windowSize: 60000
});
```

### Adjust File Size Limits
```typescript
// Allow larger PDFs for research features
fileSizeValidator.addFileType('pdf', 100); // 100MB instead of 50MB

// Restrict text uploads
fileSizeValidator.addFileType('txt', 2); // 2MB instead of 10MB
```

## Troubleshooting

### Problem: "Too many requests" error immediately
**Cause**: Rate limit is too strict  
**Solution**: 
```typescript
rateLimiter.configure({ requestsPerWindow: 20 }); // Increase limit
```

### Problem: Requests queuing for long time
**Cause**: Max concurrent too low  
**Solution**:
```typescript
requestQueue.configure({ maxConcurrent: 3 }); // Increase from 2
```

### Problem: File uploads failing with size error
**Cause**: File size limit too strict  
**Solution**:
```typescript
fileSizeValidator.addFileType('pdf', 100); // Increase limit
```

### Problem: Duplicate requests not being detected
**Cause**: Request hash not stable or dedup window too short  
**Solution**:
```typescript
// Use stable hash based on content, not timestamps
const hash = `${subject}_${difficulty}_${content.length}`;

// Increase dedup window
requestDeduplicator.configure({ windowSize: 5000 }); // 5s instead of 2s
```

## Integration Checklist

When adding request queue to a new operation:

- [ ] Import `requestQueue`, `rateLimiter`, `fileSizeValidator`, `requestDeduplicator`
- [ ] Add rate limit check at start of function
- [ ] Create unique request ID
- [ ] Create stable dedup hash
- [ ] If file upload: validate size
- [ ] Wrap operation in `requestQueue.enqueue()`
- [ ] Add proper error handling
- [ ] Add user-facing feedback (toasts)
- [ ] Test with concurrent clicks
- [ ] Monitor queue metrics in dev tools

