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
 * Binary Priority Queue (Heap)
 * Generic binary heap implementation: compare(a, b) returns true if 'a' has higher priority than 'b'.
 */
class PriorityQueue {
  constructor(compare) {
    this.data = [];
    this.compare = compare;
  }

  get size() {
    return this.data.length;
  }

  push(item) {
    this.data.push(item);
    let i = this.data.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.compare(this.data[i], this.data[p])) break;
      [this.data[i], this.data[p]] = [this.data[p], this.data[i]];
      i = p;
    }
  }

  pop() {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const last = this.data.pop();
    if (this.data.length > 0) {
      this.data[0] = last;
      let i = 0;
      while (true) {
        let best = i;
        const left = 2 * i + 1;
        const right = 2 * i + 2;
        if (left < this.data.length && this.compare(this.data[left], this.data[best])) best = left;
        if (right < this.data.length && this.compare(this.data[right], this.data[best])) best = right;
        if (best === i) break;
        [this.data[i], this.data[best]] = [this.data[best], this.data[i]];
        i = best;
      }
    }
    return top;
  }
}

function heapPriority(jobs, config) {
  const { numServers, serverCpu, serverMemory } = config;

  // Step 1: Initialize dual heaps
  // Max-Heap for ready jobs: highest priority first (tie-breaker: earlier arrival)
  const jobMaxHeap = new PriorityQueue((a, b) =>
    a.priority !== b.priority ? a.priority > b.priority : a.arrivalTime < b.arrivalTime || a.id < b.id
  );

  // Min-Heap for servers: earliest freeTime first (tie-breaker: lower server ID)
  const serverMinHeap = new PriorityQueue((a, b) =>
    a.freeTime !== b.freeTime ? a.freeTime < b.freeTime : a.id < b.id
  );

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
