/**
 * Greedy Shortest-Job-First (SJF) Workload Scheduler
 * Sorts jobs by ascending duration and places each onto the earliest-free server.
 * Time Complexity: O(n log n + n * s) | Space Complexity: O(n + s)
 */

const {
  createServers,
  snapshotServers,
  placeOnServer,
  computeMetrics,
} = require('./metrics');

function sjf(jobs, config) {
  const { numServers, serverCpu, serverMemory } = config;

  // Step 1: Sort jobs by ascending duration (shorter jobs first)
  const sortedJobs = [...jobs].sort(
    (a, b) => a.duration - b.duration || a.arrivalTime - b.arrivalTime || a.id - b.id
  );

  // Step 2: Initialize cluster servers
  const servers = createServers(numServers);
  const assignments = [];
  const trace = [];
  let rejectedCount = 0;

  trace.push({
    action: 'init',
    message: `SJF initialized: sorted ${sortedJobs.length} jobs by ascending execution duration.`,
    servers: snapshotServers(servers),
    highlightJobId: null,
  });

  // Step 3: Assign each job to the server that frees earliest
  for (const currentJob of sortedJobs) {
    trace.push({
      action: 'consider',
      message: `Evaluating Job ${currentJob.id} (Shortest remaining duration: ${currentJob.duration} units)`,
      jobId: currentJob.id,
      highlightJobId: currentJob.id,
      servers: snapshotServers(servers),
    });

    // Find the server that becomes available earliest
    let bestServer = null;
    let earliestStartTime = Infinity;

    for (const server of servers) {
      if (currentJob.cpu > serverCpu || currentJob.memory > serverMemory) {
        continue;
      }

      const possibleStartTime = Math.max(currentJob.arrivalTime, server.freeTime);

      if (possibleStartTime < earliestStartTime) {
        earliestStartTime = possibleStartTime;
        bestServer = server;
      } else if (possibleStartTime === earliestStartTime && (!bestServer || server.id < bestServer.id)) {
        bestServer = server;
      }
    }

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

    // Place job on best server
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

  // Step 4: Compute final metrics
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
