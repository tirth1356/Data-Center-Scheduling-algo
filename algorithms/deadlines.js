/**
 * Job Sequencing with Deadlines
 * Uses a Disjoint-Set (Union-Find) data structure to find the latest free time slot
 * at or before each job's deadline in near-constant amortized time.
 * Time Complexity: O(n log n + n * s * alpha(D)) | Space Complexity: O(s * D)
 */

const {
  createServers,
  snapshotServers,
  computeMetrics,
} = require('./metrics');

/**
 * Disjoint-Set (Union-Find) structure for discrete timeline slots.
 * parent[t] points to the latest available free time slot <= t.
 */
class SlotUnionFind {
  constructor(maxSlot) {
    // Initially, each slot t is free and points to itself
    this.parent = Array.from({ length: maxSlot + 2 }, (_, i) => i);
  }

  // Find root with path compression
  find(x) {
    if (x < 0) return -1;
    if (this.parent[x] === x) return x;
    this.parent[x] = this.find(this.parent[x]);
    return this.parent[x];
  }

  // Mark slots [start, start + duration) as occupied
  occupy(start, duration) {
    for (let t = start; t < start + duration; t++) {
      this.parent[t] = t === 0 ? -1 : this.find(t - 1);
    }
  }
}

// Find latest contiguous window [start, start + duration) before deadline
function findLatestAvailableStart(unionFind, deadline, duration, arrivalTime) {
  const maxAllowedSlot = unionFind.parent.length - 2;
  let targetFinishTime = Math.min(deadline, maxAllowedSlot);

  while (targetFinishTime - duration >= arrivalTime) {
    let windowIsAllFree = true;

    for (let t = targetFinishTime - 1; t >= targetFinishTime - duration; t--) {
      const freeSlot = unionFind.find(t);

      if (freeSlot !== t) {
        windowIsAllFree = false;
        if (freeSlot < 0) return null;
        targetFinishTime = freeSlot + 1;
        break;
      }
    }

    if (windowIsAllFree) {
      return targetFinishTime - duration;
    }
  }

  return null;
}

function jobSequencingDeadlines(jobs, config) {
  const { numServers, serverCpu, serverMemory } = config;

  // Step 1: Sort jobs descending by priority (highest value first)
  const sortedJobs = [...jobs].sort(
    (a, b) => b.priority - a.priority || a.deadline - b.deadline || a.id - b.id
  );

  // Step 2: Initialize Union-Find structure for each server
  const maxDeadline = Math.max(1, ...jobs.map((j) => j.deadline));
  const serverUFs = Array.from({ length: numServers }, () => new SlotUnionFind(maxDeadline + 1));
  const servers = createServers(numServers);
  const trace = [];
  const assignments = [];
  let rejectedCount = 0;

  trace.push({
    action: 'init',
    message: `Job Sequencing with Deadlines: ${sortedJobs.length} jobs sorted by priority (using Disjoint-Set union-find slots).`,
    servers: snapshotServers(servers),
    highlightJobId: null,
  });

  // Step 3: Schedule jobs in priority order
  for (const currentJob of sortedJobs) {
    trace.push({
      action: 'consider',
      message: `Evaluating Job ${currentJob.id} (Priority: ${currentJob.priority}, Deadline: ${currentJob.deadline}, Duration: ${currentJob.duration})`,
      jobId: currentJob.id,
      highlightJobId: currentJob.id,
      servers: snapshotServers(servers),
    });

    // Check capacity limits
    if (currentJob.cpu > serverCpu || currentJob.memory > serverMemory) {
      rejectedCount += 1;
      trace.push({
        action: 'reject',
        message: `Job ${currentJob.id} rejected: exceeds per-node capacity.`,
        jobId: currentJob.id,
        highlightJobId: currentJob.id,
        servers: snapshotServers(servers),
      });
      continue;
    }

    // Find latest free slot before deadline across servers
    let bestSlot = null;
    for (let serverIndex = 0; serverIndex < numServers; serverIndex++) {
      const latestStart = findLatestAvailableStart(
        serverUFs[serverIndex],
        currentJob.deadline,
        currentJob.duration,
        currentJob.arrivalTime
      );

      if (latestStart != null) {
        if (!bestSlot || latestStart > bestSlot.startTime ||
           (latestStart === bestSlot.startTime && serverIndex + 1 < bestSlot.serverId)) {
          bestSlot = {
            serverIndex,
            serverId: serverIndex + 1,
            startTime: latestStart,
          };
        }
      }
    }

    if (!bestSlot) {
      rejectedCount += 1;
      trace.push({
        action: 'reject',
        message: `Job ${currentJob.id} rejected: no available slot before deadline ${currentJob.deadline}.`,
        jobId: currentJob.id,
        highlightJobId: currentJob.id,
        servers: snapshotServers(servers),
      });
      continue;
    }

    // Allocate slot using Union-Find occupy()
    const targetServer = servers[bestSlot.serverIndex];
    const endTime = bestSlot.startTime + currentJob.duration;

    serverUFs[bestSlot.serverIndex].occupy(bestSlot.startTime, currentJob.duration);

    targetServer.timeline.push({
      jobId: currentJob.id,
      startTime: bestSlot.startTime,
      endTime,
      cpu: currentJob.cpu,
      memory: currentJob.memory,
    });
    targetServer.freeTime = Math.max(targetServer.freeTime, endTime);

    assignments.push({
      jobId: currentJob.id,
      serverId: bestSlot.serverId,
      startTime: bestSlot.startTime,
      endTime,
      waitTime: bestSlot.startTime - currentJob.arrivalTime,
      missedDeadline: endTime > currentJob.deadline,
      priority: currentJob.priority,
    });

    trace.push({
      action: 'place',
      message: `Assigned Job ${currentJob.id} to Server ${bestSlot.serverId} in slot [${bestSlot.startTime}, ${endTime}) <= Deadline ${currentJob.deadline}`,
      jobId: currentJob.id,
      serverId: bestSlot.serverId,
      startTime: bestSlot.startTime,
      endTime,
      highlightJobId: currentJob.id,
      servers: snapshotServers(servers),
    });
  }

  // Step 4: Compute metrics
  const metrics = computeMetrics(assignments, jobs, servers, config, rejectedCount);

  trace.push({
    action: 'done',
    message: `Job Sequencing complete: ${metrics.jobsCompleted}/${jobs.length} completed, Total Priority: ${metrics.totalPriority}`,
    metrics,
    servers: snapshotServers(servers),
    highlightJobId: null,
  });

  return {
    algorithm: 'deadlines',
    assignments,
    metrics,
    trace,
  };
}

module.exports = { jobSequencingDeadlines };
