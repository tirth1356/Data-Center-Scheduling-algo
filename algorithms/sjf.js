/**
 * ============================================================================
 * ALGORITHM 2: GREEDY SHORTEST-JOB-FIRST (SJF) SCHEDULER
 * ============================================================================
 * 
 * DAA PARADIGM: Greedy Strategy
 * 
 * TIME COMPLEXITY:  O(n log n + n * s)
 *   - Sorting n jobs by duration: O(n log n)
 *   - Placing n jobs across s servers: O(n * s)
 * 
 * SPACE COMPLEXITY: O(n + s)
 *   - Job assignments and server timeline states.
 * 
 * ----------------------------------------------------------------------------
 * HOW TO EXPLAIN TO YOUR TEACHER (VIVA NOTES):
 * ----------------------------------------------------------------------------
 * 1. "SJF is a greedy algorithm where the greedy choice criterion is job duration."
 * 2. "Why does SJF minimize average waiting time?"
 *     "If jobs have durations d_1 <= d_2 <= ... <= d_n, earlier jobs appear in the
 *      waiting time of all subsequent jobs. By placing smaller durations first,
 *      we minimize the cumulative sum of waiting times: sum_{i=1}^n (n - i) * d_i."
 * 3. "For multi-server execution, we iterate through the sorted list and place each
 *      job on whichever server becomes free earliest."
 * ============================================================================
 */

const {
  createServers,
  snapshotServers,
  placeOnServer,
  computeMetrics,
} = require('./metrics');

function sjf(jobs, config) {
  const { numServers, serverCpu, serverMemory } = config;

  // STEP 1: Greedy Sort by ascending duration (shorter jobs first)
  const sortedJobs = [...jobs].sort(
    (a, b) => a.duration - b.duration || a.arrivalTime - b.arrivalTime || a.id - b.id
  );

  // STEP 2: Initialize cluster servers
  const servers = createServers(numServers);
  const assignments = [];
  const trace = [];
  let rejectedCount = 0;

  trace.push({
    action: 'init',
    message: `Greedy SJF initialized: sorted ${sortedJobs.length} jobs by ascending execution duration.`,
    servers: snapshotServers(servers),
    highlightJobId: null,
  });

  // STEP 3: Greedy allocation loop
  for (const currentJob of sortedJobs) {
    trace.push({
      action: 'consider',
      message: `Greedy Choice: Pick Job ${currentJob.id} (Shortest remaining duration: ${currentJob.duration} units)`,
      jobId: currentJob.id,
      highlightJobId: currentJob.id,
      servers: snapshotServers(servers),
    });

    // STEP 3A: Find the server that frees up earliest
    let bestServer = null;
    let earliestStartTime = Infinity;

    for (const server of servers) {
      // Check if job fits this server's CPU and Memory limits
      if (currentJob.cpu > serverCpu || currentJob.memory > serverMemory) {
        continue;
      }

      // The job can start when both the job has arrived AND the server is free
      const possibleStartTime = Math.max(currentJob.arrivalTime, server.freeTime);

      if (possibleStartTime < earliestStartTime) {
        earliestStartTime = possibleStartTime;
        bestServer = server;
      } else if (possibleStartTime === earliestStartTime && (!bestServer || server.id < bestServer.id)) {
        bestServer = server;
      }
    }

    // STEP 3B: If no server can accommodate the job, reject it
    if (!bestServer) {
      rejectedCount += 1;
      trace.push({
        action: 'reject',
        message: `Job ${currentJob.id} rejected: exceeds node capacity constraints.`,
        jobId: currentJob.id,
        highlightJobId: currentJob.id,
        servers: snapshotServers(servers),
      });
      continue;
    }

    // STEP 3C: Place the job on the earliest-free server
    const assignment = placeOnServer(bestServer, currentJob, serverCpu, serverMemory);
    assignments.push(assignment);

    trace.push({
      action: 'place',
      message: `Assigned Job ${currentJob.id} to Server ${bestServer.id} [Start: ${assignment.startTime}, End: ${assignment.endTime})`,
      jobId: currentJob.id,
      serverId: bestServer.id,
      startTime: assignment.startTime,
      endTime: assignment.endTime,
      highlightJobId: currentJob.id,
      servers: snapshotServers(servers),
    });
  }

  // STEP 4: Compute final metrics
  const metrics = computeMetrics(assignments, jobs, servers, config, rejectedCount);

  trace.push({
    action: 'done',
    message: `SJF completed: ${metrics.jobsCompleted}/${jobs.length} completed, Avg Wait Time: ${metrics.averageWaitTime}`,
    metrics,
    servers: snapshotServers(servers),
    highlightJobId: null,
  });

  return {
    algorithm: 'sjf',
    assignments,
    metrics,
    trace,
  };
}

module.exports = { sjf };
