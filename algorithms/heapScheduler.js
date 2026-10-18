/**
 * ============================================================================
 * ALGORITHM 5: DUAL-HEAP PRIORITY QUEUE SCHEDULER
 * ============================================================================
 * 
 * DAA PARADIGM: Priority Queues & Complete Binary Min/Max Heaps
 * 
 * TIME COMPLEXITY:  O(n log n)
 *   - Pushing n jobs into Job Max-Heap: O(n log n).
 *   - Popping highest-priority job: O(log n).
 *   - Popping earliest server from Server Min-Heap and re-inserting: O(log s).
 *   - Total Time = O(n log n + n log s). Since s <= n, this simplifies to O(n log n).
 * 
 * SPACE COMPLEXITY: O(n + s)
 *   - Max-Heap array of size n for queued jobs.
 *   - Min-Heap array of size s for servers.
 * 
 * ----------------------------------------------------------------------------
 * HEAP DATA STRUCTURE FUNDAMENTALS (FOR VIVA):
 * ----------------------------------------------------------------------------
 * A binary heap is stored compactly inside a standard 0-indexed array:
 *   - Parent index of element at index i:   Math.floor((i - 1) / 2)
 *   - Left child of element at index i:     2 * i + 1
 *   - Right child of element at index i:    2 * i + 2
 * 
 * 1. Insertion (push):
 *    - Append new element to the end of array (maintains complete binary tree property).
 *    - Call bubbleUp(index) to restore heap-order property in O(log n) swaps.
 * 
 * 2. Deletion (pop):
 *    - The root (index 0) holds the extreme element (max or min).
 *    - Swap root with the last element and remove the last element.
 *    - Call bubbleDown(0) from root to restore heap-order property in O(log n) swaps.
 * 
 * ----------------------------------------------------------------------------
 * HOW TO EXPLAIN TO YOUR TEACHER (VIVA NOTES):
 * ----------------------------------------------------------------------------
 * 1. "We implement a Dual-Heap architecture:"
 *      a) Max-Heap: Holds ready jobs ordered by priority (highest priority first).
 *      b) Min-Heap: Holds servers ordered by freeTime (earliest available first).
 * 2. "As simulation time advances, arriving jobs are enqueued into the Max-Heap."
 * 3. "We pop the top job from the Max-Heap and assign it to the top server
 *      popped from the Min-Heap."
 * 4. "Once updated with the job's duration, the server is pushed back into the Min-Heap."
 * ============================================================================
 */

const {
  createServers,
  snapshotServers,
  placeOnServer,
  computeMetrics,
} = require('./metrics');

/**
 * Complete Binary Max-Heap (Highest priority element at root index 0).
 */
class MaxHeap {
  constructor(compareFunction) {
    this.data = [];
    this.compare = compareFunction;
  }

  get size() {
    return this.data.length;
  }

  push(item) {
    this.data.push(item);
    this.bubbleUp(this.data.length - 1);
  }

  pop() {
    if (this.data.length === 0) return undefined;
    const topElement = this.data[0];
    const lastElement = this.data.pop();

    if (this.data.length > 0) {
      this.data[0] = lastElement;
      this.bubbleDown(0);
    }
    return topElement;
  }

  bubbleUp(index) {
    while (index > 0) {
      const parentIndex = (index - 1) >> 1; // Math.floor((index - 1) / 2)

      // If current element <= parent, heap invariant is satisfied
      if (this.compare(this.data[index], this.data[parentIndex]) <= 0) {
        break;
      }

      // Swap with parent
      [this.data[index], this.data[parentIndex]] = [this.data[parentIndex], this.data[index]];
      index = parentIndex;
    }
  }

  bubbleDown(index) {
    const totalElements = this.data.length;

    while (true) {
      let largest = index;
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;

      if (leftChild < totalElements && this.compare(this.data[leftChild], this.data[largest]) > 0) {
        largest = leftChild;
      }
      if (rightChild < totalElements && this.compare(this.data[rightChild], this.data[largest]) > 0) {
        largest = rightChild;
      }

      if (largest === index) break; // Heap invariant satisfied!

      // Swap with larger child
      [this.data[index], this.data[largest]] = [this.data[largest], this.data[index]];
      index = largest;
    }
  }
}

/**
 * Complete Binary Min-Heap (Lowest value at root index 0).
 */
class MinHeap {
  constructor(compareFunction) {
    this.data = [];
    this.compare = compareFunction;
  }

  get size() {
    return this.data.length;
  }

  push(item) {
    this.data.push(item);
    this.bubbleUp(this.data.length - 1);
  }

  pop() {
    if (this.data.length === 0) return undefined;
    const topElement = this.data[0];
    const lastElement = this.data.pop();

    if (this.data.length > 0) {
      this.data[0] = lastElement;
      this.bubbleDown(0);
    }
    return topElement;
  }

  bubbleUp(index) {
    while (index > 0) {
      const parentIndex = (index - 1) >> 1;

      // If current element >= parent, min-heap invariant satisfied
      if (this.compare(this.data[index], this.data[parentIndex]) >= 0) {
        break;
      }

      // Swap with parent
      [this.data[index], this.data[parentIndex]] = [this.data[parentIndex], this.data[index]];
      index = parentIndex;
    }
  }

  bubbleDown(index) {
    const totalElements = this.data.length;

    while (true) {
      let smallest = index;
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;

      if (leftChild < totalElements && this.compare(this.data[leftChild], this.data[smallest]) < 0) {
        smallest = leftChild;
      }
      if (rightChild < totalElements && this.compare(this.data[rightChild], this.data[smallest]) < 0) {
        smallest = rightChild;
      }

      if (smallest === index) break;

      // Swap with smaller child
      [this.data[index], this.data[smallest]] = [this.data[smallest], this.data[index]];
      index = smallest;
    }
  }
}

function heapPriority(jobs, config) {
  const { numServers, serverCpu, serverMemory } = config;

  // STEP 1: Initialize Dual Heaps
  // Heap A: Max-Heap for Jobs ordered by Priority (tie-break: arrival time)
  const jobMaxHeap = new MaxHeap((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.arrivalTime - b.arrivalTime || a.id - b.id;
  });

  // Heap B: Min-Heap for Servers ordered by earliest Free Time
  const serverMinHeap = new MinHeap((a, b) => {
    if (a.freeTime !== b.freeTime) return a.freeTime - b.freeTime;
    return a.id - b.id;
  });

  const servers = createServers(numServers);
  for (const s of servers) {
    serverMinHeap.push(s);
  }

  // Sort jobs by arrival time to simulate chronological arrival stream
  const arrivalStream = [...jobs].sort(
    (a, b) => a.arrivalTime - b.arrivalTime || a.id - b.id
  );

  let streamIndex = 0;
  let currentSimulationTime = arrivalStream.length ? arrivalStream[0].arrivalTime : 0;
  const assignments = [];
  const trace = [];
  let rejectedCount = 0;

  trace.push({
    action: 'init',
    message: `Dual-Heap Scheduler initialized: Job Max-Heap (by priority) + Server Min-Heap (by free-time).`,
    servers: snapshotServers(servers),
    highlightJobId: null,
  });

  // Helper function to enqueue jobs that have arrived by time 't'
  const enqueueArrivedJobs = (t) => {
    while (streamIndex < arrivalStream.length && arrivalStream[streamIndex].arrivalTime <= t) {
      const arrivingJob = arrivalStream[streamIndex];
      jobMaxHeap.push(arrivingJob);

      trace.push({
        action: 'enqueue',
        message: `Enqueued Job ${arrivingJob.id} into Max-Heap (Priority: ${arrivingJob.priority})`,
        jobId: arrivingJob.id,
        highlightJobId: arrivingJob.id,
        servers: snapshotServers(servers),
      });

      streamIndex += 1;
    }
  };

  // STEP 2: Main Event Loop (continue while jobs remain in arrival stream or in heap)
  while (streamIndex < arrivalStream.length || jobMaxHeap.size > 0) {
    // If heap is empty, jump time forward to next job's arrival
    if (streamIndex < arrivalStream.length && jobMaxHeap.size === 0) {
      currentSimulationTime = arrivalStream[streamIndex].arrivalTime;
    }

    enqueueArrivedJobs(currentSimulationTime);

    if (jobMaxHeap.size === 0) break;

    // STEP 2A: Extract highest priority job from Max-Heap
    const highestPriorityJob = jobMaxHeap.pop();

    trace.push({
      action: 'consider',
      message: `Max-Heap Pop: Selected highest priority Job ${highestPriorityJob.id} (Priority: ${highestPriorityJob.priority})`,
      jobId: highestPriorityJob.id,
      highlightJobId: highestPriorityJob.id,
      servers: snapshotServers(servers),
    });

    // STEP 2B: Validate node resource limits
    if (highestPriorityJob.cpu > serverCpu || highestPriorityJob.memory > serverMemory) {
      rejectedCount += 1;
      trace.push({
        action: 'reject',
        message: `Job ${highestPriorityJob.id} rejected: exceeds physical node capacity.`,
        jobId: highestPriorityJob.id,
        highlightJobId: highestPriorityJob.id,
        servers: snapshotServers(servers),
      });
      continue;
    }

    // STEP 2C: Extract earliest-available server from Min-Heap
    const earliestServer = serverMinHeap.pop();
    const previousFreeTime = earliestServer.freeTime;

    const assignment = placeOnServer(earliestServer, highestPriorityJob, serverCpu, serverMemory);
    assignments.push(assignment);

    // Re-insert server with updated freeTime into Min-Heap
    serverMinHeap.push(earliestServer);

    trace.push({
      action: 'place',
      message: `Server Min-Heap: Assigned Job ${highestPriorityJob.id} to Server ${earliestServer.id} (Earliest free @ ${previousFreeTime} ➔ Now busy until ${assignment.endTime})`,
      jobId: highestPriorityJob.id,
      serverId: earliestServer.id,
      startTime: assignment.startTime,
      endTime: assignment.endTime,
      highlightJobId: highestPriorityJob.id,
      servers: snapshotServers(servers),
    });

    currentSimulationTime = Math.max(currentSimulationTime, assignment.startTime);
  }

  // STEP 3: Compute final metrics
  const metrics = computeMetrics(assignments, jobs, servers, config, rejectedCount);

  trace.push({
    action: 'done',
    message: `Dual-Heap scheduling complete: ${metrics.jobsCompleted}/${jobs.length} completed.`,
    metrics,
    servers: snapshotServers(servers),
  });

  return {
    algorithm: 'heap',
    assignments,
    metrics,
    trace,
  };
}

module.exports = { heapPriority };
