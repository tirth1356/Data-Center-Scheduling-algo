const {
  createServers,
  snapshotServers,
  placeOnServer,
  computeMetrics,
} = require('./metrics');

/** Greedy shortest-job-first: sort by duration, assign to server that frees earliest. */
function sjf(jobs, config) {
  const { numServers, serverCpu, serverMemory } = config;
  const sorted = [...jobs].sort(
    (a, b) => a.duration - b.duration || a.arrivalTime - b.arrivalTime || a.id - b.id
  );
  const servers = createServers(numServers);
  const trace = [];
  const assignments = [];
  let rejected = 0;

  trace.push({
    action: 'init',
    message: `SJF: ${sorted.length} jobs by increasing duration`,
    servers: snapshotServers(servers),
    highlightJobId: null,
  });

  for (const job of sorted) {
    trace.push({
      action: 'consider',
      message: `Consider job ${job.id} (duration ${job.duration})`,
      jobId: job.id,
      highlightJobId: job.id,
      servers: snapshotServers(servers),
    });

    let best = null;
    for (const server of servers) {
      if (job.cpu > serverCpu || job.memory > serverMemory) continue;
      const startTime = Math.max(job.arrivalTime, server.freeTime);
      if (!best || startTime < best.startTime || (startTime === best.startTime && server.id < best.server.id)) {
        best = { server, startTime };
      }
    }

    if (!best) {
      rejected += 1;
      trace.push({
        action: 'reject',
        message: `No server fits job ${job.id}`,
        jobId: job.id,
        highlightJobId: job.id,
        servers: snapshotServers(servers),
      });
      continue;
    }

    const assignment = placeOnServer(best.server, job, serverCpu, serverMemory);
    assignments.push(assignment);
    trace.push({
      action: 'place',
      message: `Place job ${job.id} on server ${best.server.id} (earliest free @ ${best.startTime})`,
      jobId: job.id,
      serverId: best.server.id,
      startTime: assignment.startTime,
      endTime: assignment.endTime,
      highlightJobId: job.id,
      servers: snapshotServers(servers),
    });
  }

  const metrics = computeMetrics(assignments, jobs, servers, config, rejected);
  trace.push({ action: 'done', message: 'SJF complete', metrics, servers: snapshotServers(servers) });
  return { algorithm: 'sjf', assignments, metrics, trace };
}

module.exports = { sjf };
