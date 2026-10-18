/**
 * ============================================================================
 * ALGORITHM 3: JOB SEQUENCING WITH DEADLINES (DISJOINT-SET UNION-FIND)
 * ============================================================================
 * 
 * DAA PARADIGM: Greedy Algorithm + Disjoint-Set (Union-Find) Data Structure
 * 
 * TIME COMPLEXITY:  O(n log n + n * s * alpha(D))
 *   - Sorting jobs by descending priority: O(n log n).
 *   - Finding free slots across s servers using Union-Find with Path Compression:
 *     takes nearly linear time O(n * s * alpha(D)), where alpha is the inverse
 *     Ackermann function (practically <= 4).
 * 
 * SPACE COMPLEXITY: O(s * D)
 *   - Union-Find parent array of size D (maximum deadline horizon) per server.
 * 
 * ----------------------------------------------------------------------------
 * HOW TO EXPLAIN TO YOUR TEACHER (VIVA NOTES):
 * ----------------------------------------------------------------------------
 * 1. "Job Sequencing with Deadlines is a classic greedy problem from DAA."
 * 2. "Greedy Choice: Process jobs with HIGHEST PRIORITY first."
 * 3. "Scheduling Rule: To leave as much room as possible for other jobs,
 *      each job should be placed as LATE as possible before its deadline."
 * 4. "Why Disjoint-Set (Union-Find)?"
 *      - "A naive search scans backward from deadline: O(D) per job."
 *      - "Union-Find maintains sets of available time slots."
 *      - "parent[t] points to the latest free slot at or before time t."
 *      - "When slot t is occupied, we union it with slot t - 1: parent[t] = find(t - 1)."
 *      - "Path compression flattens the tree so find() runs in O(alpha(D)) amortized time."
 * ============================================================================
 */

const {
  createServers,
  snapshotServers,
  computeMetrics,
} = require('./metrics');

/**
 * Disjoint-Set (Union-Find) for discrete time slots on a server timeline.
 * parent[t] represents the latest available free time slot <= t.
 */
class SlotUnionFind {
  constructor(maxSlot) {
    // Initially, every slot t is free, so it points to itself: parent[t] = t
    this.parent = Array.from({ length: maxSlot + 2 }, (_, i) => i);
  }

  /**
   * find(x): Finds the latest available free slot <= x with PATH COMPRESSION.
   */
  find(x) {
    if (x < 0) return -1; // No free slots left before time 0
    if (this.parent[x] === x) return x; // Found the free slot root!

    // Path compression: flatten tree by pointing directly to root
    this.parent[x] = this.find(this.parent[x]);
    return this.parent[x];
  }

  /**
   * occupy(start, duration): Marks slots [start, start + duration) as occupied.
   * Merges occupied slots to point to the nearest preceding free slot.
   */
  occupy(start, duration) {
    for (let t = start; t < start + duration; t++) {
      // Slot t is now taken; its new parent points to the free slot before t
      this.parent[t] = t === 0 ? -1 : this.find(t - 1);
    }
  }
}

/**
 * Helper to find the latest valid start time for a job of given duration
 * such that the entire window [start, start + duration) is free and ends <= deadline.
 */
function findLatestAvailableStart(unionFind, deadline, duration, arrivalTime) {
  const maxAllowedSlot = unionFind.parent.length - 2;
  let targetFinishTime = Math.min(deadline, maxAllowedSlot);

  // Scan downward from deadline to find a free window of size 'duration'
  while (targetFinishTime - duration >= arrivalTime) {
    let windowIsAllFree = true;

    for (let t = targetFinishTime - 1; t >= targetFinishTime - duration; t--) {
      const freeSlot = unionFind.find(t);

      if (freeSlot !== t) {
        // Slot t is occupied! Skip targetFinishTime past the occupied block
        windowIsAllFree = false;
        if (freeSlot < 0) return null; // No free slots left before t
        targetFinishTime = freeSlot + 1;
        break;
      }
    }

    if (windowIsAllFree) {
      return targetFinishTime - duration;
    }
  }

  return null; // No slot found before deadline
}

function jobSequencingDeadlines(jobs, config) {
  const { numServers, serverCpu, serverMemory } = config;

  // STEP 1: Greedy Sort by priority descending (highest value/profit first)
  const sortedJobs = [...jobs].sort(
    (a, b) => b.priority - a.priority || a.deadline - b.deadline || a.id - b.id
  );

  // STEP 2: Initialize Union-Find structure for each server
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

  // STEP 3: Schedule jobs in priority order
  for (const currentJob of sortedJobs) {
    trace.push({
      action: 'consider',
      message: `Evaluating Job ${currentJob.id} (Highest Priority: ${currentJob.priority}, Deadline: ${currentJob.deadline}, Duration: ${currentJob.duration})`,
      jobId: currentJob.id,
      highlightJobId: currentJob.id,
      servers: snapshotServers(servers),
    });

    // STEP 3A: Check if job exceeds server capacity
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

    // STEP 3B: Find latest available slot before deadline across all servers
    let bestSlot = null;

    for (let serverIndex = 0; serverIndex < numServers; serverIndex++) {
      const latestStart = findLatestAvailableStart(
        serverUFs[serverIndex],
        currentJob.deadline,
        currentJob.duration,
        currentJob.arrivalTime
      );

      if (latestStart != null) {
        // We prefer the slot that starts latest (leaves earlier time free for others)
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

    // STEP 3C: If no server has a free slot before the deadline, job cannot be scheduled
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

    // STEP 3D: Allocate the slot using Union-Find occupy()
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
      message: `Assigned Job ${currentJob.id} (Prio ${currentJob.priority}) to Server ${bestSlot.serverId} in slot [${bestSlot.startTime}, ${endTime}) <= Deadline ${currentJob.deadline}`,
      jobId: currentJob.id,
      serverId: bestSlot.serverId,
      startTime: bestSlot.startTime,
      endTime,
      highlightJobId: currentJob.id,
      servers: snapshotServers(servers),
    });
  }

  // STEP 4: Compute performance metrics
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
