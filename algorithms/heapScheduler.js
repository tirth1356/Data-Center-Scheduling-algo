const {
  createServers,
  snapshotServers,
  placeOnServer,
  computeMetrics,
} = require('./metrics');

class MaxHeap {
  constructor(compare) {
    this.data = [];
    this.compare = compare;
  }
  push(x) {
    this.data.push(x);
    this.bubbleUp(this.data.length - 1);
  }
  pop() {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const last = this.data.pop();
    if (this.data.length) {
      this.data[0] = last;
      this.bubbleDown(0);
    }
    return top;
  }
  peek() {
    return this.data[0];
  }
  get size() {
    return this.data.length;
  }
  bubbleUp(i) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.compare(this.data[i], this.data[p]) <= 0) break;
      [this.data[i], this.data[p]] = [this.data[p], this.data[i]];
      i = p;
    }
  }
  bubbleDown(i) {
    const n = this.data.length;
    while (true) {
      let best = i;
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      if (l < n && this.compare(this.data[l], this.data[best]) > 0) best = l;
      if (r < n && this.compare(this.data[r], this.data[best]) > 0) best = r;
      if (best === i) break;
      [this.data[i], this.data[best]] = [this.data[best], this.data[i]];
      i = best;
    }
  }
}

class MinHeap {
  constructor(compare) {
    this.data = [];
    this.compare = compare;
  }
  push(x) {
    this.data.push(x);
    this.bubbleUp(this.data.length - 1);
  }
  pop() {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const last = this.data.pop();
    if (this.data.length) {
      this.data[0] = last;
      this.bubbleDown(0);
    }
    return top;
  }
  bubbleUp(i) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.compare(this.data[i], this.data[p]) >= 0) break;
      [this.data[i], this.data[p]] = [this.data[p], this.data[i]];
      i = p;
    }
  }
  bubbleDown(i) {
    const n = this.data.length;
    while (true) {
      let best = i;
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      if (l < n && this.compare(this.data[l], this.data[best]) < 0) best = l;
      if (r < n && this.compare(this.data[r], this.data[best]) < 0) best = r;
      if (best === i) break;
      [this.data[i], this.data[best]] = [this.data[best], this.data[i]];
      i = best;
    }
  }
}

/** Priority max-heap for jobs; min-heap of servers by free time. */
function heapPriority(jobs, config) {
  const { numServers, serverCpu, serverMemory } = config;
  const servers = createServers(numServers);
  const trace = [];
  const assignments = [];
  let rejected = 0;

  const jobHeap = new MaxHeap((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.arrivalTime - b.arrivalTime || a.id - b.id;
  });

  const sorted = [...jobs].sort((a, b) => a.arrivalTime - b.arrivalTime || a.id - b.id);
  let idx = 0;
  let time = sorted.length ? sorted[0].arrivalTime : 0;

  trace.push({
    action: 'init',
    message: 'Heap scheduler: max-heap jobs, min-heap server free times',
    servers: snapshotServers(servers),
    highlightJobId: null,
  });

  const pushArrivals = (t) => {
    while (idx < sorted.length && sorted[idx].arrivalTime <= t) {
      jobHeap.push(sorted[idx]);
      trace.push({
        action: 'enqueue',
        message: `Enqueue job ${sorted[idx].id} (priority ${sorted[idx].priority})`,
        jobId: sorted[idx].id,
        highlightJobId: sorted[idx].id,
        servers: snapshotServers(servers),
      });
      idx += 1;
    }
  };

  while (idx < sorted.length || jobHeap.size > 0) {
    if (idx < sorted.length && jobHeap.size === 0) {
      time = sorted[idx].arrivalTime;
    }
    pushArrivals(time);

    if (jobHeap.size === 0) break;

    const job = jobHeap.pop();
    trace.push({
      action: 'consider',
      message: `Pop highest priority job ${job.id}`,
      jobId: job.id,
      highlightJobId: job.id,
      servers: snapshotServers(servers),
    });

    const serverHeap = new MinHeap((a, b) => {
      if (a.freeTime !== b.freeTime) return a.freeTime - b.freeTime;
      return a.id - b.id;
    });
    for (const s of servers) serverHeap.push(s);

    if (job.cpu > serverCpu || job.memory > serverMemory) {
      rejected += 1;
      trace.push({
        action: 'reject',
        message: `Job ${job.id} exceeds per-server capacity (CPU ${job.cpu} > ${serverCpu} or Mem ${job.memory} > ${serverMemory})`,
        jobId: job.id,
        highlightJobId: job.id,
        servers: snapshotServers(servers),
      });
      continue;
    }

    // Earliest free server from min-heap
    const pick = serverHeap.pop();
    const savedFree = pick.freeTime;
    const assignment = placeOnServer(pick, job, serverCpu, serverMemory);
    assignments.push(assignment);
    serverHeap.push(pick);

    trace.push({
      action: 'place',
      message: `Place job ${job.id} on server ${pick.id} via server min-heap (earliest start ${assignment.startTime}, was free @ ${savedFree})`,
      jobId: job.id,
      serverId: pick.id,
      startTime: assignment.startTime,
      endTime: assignment.endTime,
      highlightJobId: job.id,
      servers: snapshotServers(servers),
    });

    time = Math.max(time, assignment.startTime);
  }

  const metrics = computeMetrics(assignments, jobs, servers, config, rejected);
  trace.push({ action: 'done', message: 'Heap scheduler complete', metrics, servers: snapshotServers(servers) });
  return { algorithm: 'heap', assignments, metrics, trace };
}

module.exports = { heapPriority };
