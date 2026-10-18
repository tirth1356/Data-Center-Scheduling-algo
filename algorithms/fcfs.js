/**
 * ============================================================================
 * ALGORITHM 1: FIRST-COME FIRST-SERVED (FCFS) SCHEDULER
 * ============================================================================
 * 
 * DAA PARADIGM: Baseline Queue / Greedy by Arrival Time
 * 
 * TIME COMPLEXITY:  O(n log n + n * s)
 *   - Sorting jobs by arrival time takes O(n log n).
 *   - Iterating over n jobs and finding the earliest free server among s servers
 *     takes O(n * s).
 * 
 * SPACE COMPLEXITY: O(n + s)
 *   - Storing n job assignments and s server state timelines.
 * 
 * ----------------------------------------------------------------------------
 * HOW TO EXPLAIN TO YOUR TEACHER (VIVA NOTES):
 * ----------------------------------------------------------------------------
 * 1. "FCFS is our baseline non-preemptive scheduling policy."
 * 2. "Jobs are processed strictly in the order they arrive (arrival time)."
 * 3. "For each arriving job, we scan our servers to see if any server is idle
 *     at the job's arrival time. If an idle server is found, we schedule it there."
 * 4. "If all servers are currently busy, we pick the server that frees up earliest."
 * 5. "If a job requires more CPU or RAM than a single node possesses, it cannot run
 *     and is marked as rejected."
 * ============================================================================
 */

const {
  createServers,
  snapshotServers,
  placeOnServer,
  computeMetrics,
} = require('./metrics');

function fcfs(jobs, config) {
  const { numServers, serverCpu, serverMemory } = config;

  // STEP 1: Sort jobs by arrival time (tie-breaker: job ID)
  const sortedJobs = [...jobs].sort(
    (a, b) => a.arrivalTime - b.arrivalTime || a.id - b.id
  );

  // STEP 2: Initialize cluster server states
  const servers = createServers(numServers);
  const assignments = [];
  const trace = [];
  let rejectedCount = 0;

  // Record initial simulation step
  trace.push({
    action: 'init',
    message: `FCFS initialized with ${sortedJobs.length} jobs across ${numServers} server nodes.`,
    servers: snapshotServers(servers),
    highlightJobId: null,
  });

  // STEP 3: Iterate through jobs in strict arrival order
  for (const currentJob of sortedJobs) {
    trace.push({
      action: 'consider',
      message: `Evaluating Job ${currentJob.id} (Arrival: ${currentJob.arrivalTime}, CPU: ${currentJob.cpu}, RAM: ${currentJob.memory}GB)`,
      jobId: currentJob.id,
      highlightJobId: currentJob.id,
      servers: snapshotServers(servers),
    });

    // STEP 3A: Validate if job fits within physical node limits
    if (currentJob.cpu > serverCpu || currentJob.memory > serverMemory) {
      rejectedCount += 1;
      trace.push({
        action: 'reject',
        message: `Job ${currentJob.id} rejected: exceeds node limits (needs CPU ${currentJob.cpu}/${serverCpu}, RAM ${currentJob.memory}/${serverMemory}GB)`,
        jobId: currentJob.id,
        highlightJobId: currentJob.id,
        servers: snapshotServers(servers),
      });
      continue;
    }

    // STEP 3B: Server Selection
    // Priority 1: Check for an idle server at or before currentJob.arrivalTime
    let selectedServer = null;
    for (const server of servers) {
      if (server.freeTime <= currentJob.arrivalTime) {
        selectedServer = server;
        break; // First server with room right now!
      }
    }

    // Priority 2: If all servers are busy, pick the one that finishes earliest
    if (!selectedServer) {
      selectedServer = servers.reduce((earliest, s) =>
        s.freeTime < earliest.freeTime ? s : earliest,
        servers[0]
      );
    }

    // STEP 3C: Place job on selected server
    const assignment = placeOnServer(selectedServer, currentJob, serverCpu, serverMemory);
    assignments.push(assignment);

    trace.push({
      action: 'place',
      message: `Assigned Job ${currentJob.id} to Server ${selectedServer.id} [Start: ${assignment.startTime}, End: ${assignment.endTime})`,
      jobId: currentJob.id,
      serverId: selectedServer.id,
      startTime: assignment.startTime,
      endTime: assignment.endTime,
      highlightJobId: currentJob.id,
      servers: snapshotServers(servers),
    });
  }

  // STEP 4: Compute final datacenter performance & green metrics
  const metrics = computeMetrics(assignments, sortedJobs, servers, config, rejectedCount);

  trace.push({
    action: 'done',
    message: `FCFS scheduling complete: ${metrics.jobsCompleted}/${jobs.length} jobs scheduled.`,
    metrics,
    servers: snapshotServers(servers),
    highlightJobId: null,
  });

  return {
    algorithm: 'fcfs',
    assignments,
    metrics,
    trace,
  };
}

module.exports = { fcfs };
