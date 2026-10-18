/**
 * Dual-Heap Priority Queue Workload Scheduler
 * Uses a Max-Heap for ready jobs (by priority) and a Min-Heap for servers (by free time).
 * Time Complexity: O(n log n) | Space Complexity: O(n + s)
 */

const {
  createServers,
  snapshotServers,
  placeOnServer,
  computeMetrics,
} = require('./metrics');

/**
 * Binary Max-Heap (Highest priority element at root index 0)
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
      const parentIndex = (index - 1) >> 1; // (index - 1) / 2

      if (this.compare(this.data[index], this.data[parentIndex]) <= 0) {
        break;
      }

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

      if (largest === index) break;

      [this.data[index], this.data[largest]] = [this.data[largest], this.data[index]];
      index = largest;
    }
  }
}

/**
 * Binary Min-Heap (Lowest value at root index 0)
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

      if (this.compare(this.data[index], this.data[parentIndex]) >= 0) {
        break;
      }

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

      [this.data[index], this.data[smallest]] = [this.data[smallest], this.data[index]];
      index = smallest;
    }
  }
}

function heapPriority(jobs, config) {
  const { numServers, serverCpu, serverMemory } = config;

  // Step 1: Initialize dual heaps
  // Max-Heap for jobs (by priority)
  const jobMaxHeap = new MaxHeap((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.arrivalTime - b.arrivalTime || a.id - b.id;
  });

  // Min-Heap for servers (by earliest free time)
  const serverMinHeap = new MinHeap((a, b) => {
    if (a.freeTime !== b.freeTime) return a.freeTime - b.freeTime;
    return a.id - b.id;
  });

  const servers = createServers(numServers);
  for (const s of servers) {
    serverMinHeap.push(s);
  }

  // Sort arrival stream chronologically
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

  // Enqueue jobs that have arrived by time 't'
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

  // Step 2: Main loop
  while (streamIndex < arrivalStream.length || jobMaxHeap.size > 0) {
    if (streamIndex < arrivalStream.length && jobMaxHeap.size === 0) {
      currentSimulationTime = arrivalStream[streamIndex].arrivalTime;
    }

    enqueueArrivedJobs(currentSimulationTime);

    if (jobMaxHeap.size === 0) break;

    // Extract highest priority job
    const highestPriorityJob = jobMaxHeap.pop();

    trace.push({
      action: 'consider',
      message: `Max-Heap Pop: Selected highest priority Job ${highestPriorityJob.id} (Priority: ${highestPriorityJob.priority})`,
      jobId: highestPriorityJob.id,
      highlightJobId: highestPriorityJob.id,
      servers: snapshotServers(servers),
    });

    // Check node capacity
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

    // Extract earliest available server from Min-Heap
    const earliestServer = serverMinHeap.pop();
    const previousFreeTime = earliestServer.freeTime;

    const assignment = placeOnServer(earliestServer, highestPriorityJob, serverCpu, serverMemory);
    assignments.push(assignment);

    // Push server back into Min-Heap with updated freeTime
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

  // Step 3: Compute final metrics
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
