const {
  createServers,
  snapshotServers,
  computeMetrics,
} = require('./metrics');

/** Union-find for latest free slot on a discrete timeline (per server). */
class SlotUnionFind {
  constructor(maxSlot) {
    this.parent = Array.from({ length: maxSlot + 2 }, (_, i) => i);
  }

  find(x) {
    if (x < 0) return -1;
    if (this.parent[x] === x) return x;
    if (this.parent[x] < 0) return this.parent[x];
    this.parent[x] = this.find(this.parent[x]);
    return this.parent[x];
  }

  occupy(start, duration) {
    for (let t = start; t < start + duration; t++) {
      this.parent[t] = t === 0 ? -1 : this.find(t - 1);
    }
  }
}

function findLatestStart(uf, deadline, duration, arrival) {
  const maxSlot = uf.parent.length - 2;
  let finish = Math.min(deadline, maxSlot);
  while (finish - duration >= arrival) {
    let ok = true;
    for (let t = finish - 1; t >= finish - duration; t--) {
      const root = uf.find(t);
      if (root !== t) {
        ok = false;
        if (root < 0) return null;
        finish = root + 1;
        break;
      }
    }
    if (ok) return finish - duration;
  }
  return null;
}

/** Job sequencing with deadlines: sort by priority, union-find slots per server. */
function jobSequencingDeadlines(jobs, config) {
  const { numServers, serverCpu, serverMemory } = config;
  const sorted = [...jobs].sort(
    (a, b) => b.priority - a.priority || a.deadline - b.deadline || a.id - b.id
  );
  const maxDeadline = Math.max(1, ...jobs.map((j) => j.deadline));
  const ufs = Array.from({ length: numServers }, () => new SlotUnionFind(maxDeadline + 1));
  const servers = createServers(numServers);
  const trace = [];
  const assignments = [];
  let rejected = 0;

  trace.push({
    action: 'init',
    message: `Deadline sequencing: ${sorted.length} jobs by priority (union-find slots)`,
    servers: snapshotServers(servers),
    highlightJobId: null,
  });

  for (const job of sorted) {
    trace.push({
      action: 'consider',
      message: `Consider job ${job.id} (priority ${job.priority}, deadline ${job.deadline})`,
      jobId: job.id,
      highlightJobId: job.id,
      servers: snapshotServers(servers),
    });

    if (job.cpu > serverCpu || job.memory > serverMemory) {
      rejected += 1;
      trace.push({
        action: 'reject',
        message: `Job ${job.id} exceeds per-server capacity`,
        jobId: job.id,
        highlightJobId: job.id,
        servers: snapshotServers(servers),
      });
      continue;
    }

    let best = null;
    for (let si = 0; si < numServers; si++) {
      const start = findLatestStart(ufs[si], job.deadline, job.duration, job.arrivalTime);
      if (start == null) continue;
      if (!best || start > best.start || (start === best.start && si + 1 < best.serverId)) {
        best = { serverIndex: si, start, serverId: si + 1 };
      }
    }

    if (!best) {
      rejected += 1;
      trace.push({
        action: 'reject',
        message: `No slot before deadline for job ${job.id}`,
        jobId: job.id,
        highlightJobId: job.id,
        servers: snapshotServers(servers),
      });
      continue;
    }

    const server = servers[best.serverIndex];
    const endTime = best.start + job.duration;
    ufs[best.serverIndex].occupy(best.start, job.duration);
    server.timeline.push({
      jobId: job.id,
      startTime: best.start,
      endTime,
      cpu: job.cpu,
      memory: job.memory,
    });
    server.freeTime = Math.max(server.freeTime, endTime);

    assignments.push({
      jobId: job.id,
      serverId: best.serverId,
      startTime: best.start,
      endTime,
      waitTime: best.start - job.arrivalTime,
      missedDeadline: endTime > job.deadline,
      priority: job.priority,
    });

    trace.push({
      action: 'place',
      message: `Latest slot: job ${job.id} on server ${best.serverId} [${best.start}, ${endTime})`,
      jobId: job.id,
      serverId: best.serverId,
      startTime: best.start,
      endTime,
      highlightJobId: job.id,
      servers: snapshotServers(servers),
    });
  }

  const metrics = computeMetrics(assignments, jobs, servers, config, rejected);
  trace.push({ action: 'done', message: 'Deadline sequencing complete', metrics, servers: snapshotServers(servers) });
  return { algorithm: 'deadlines', assignments, metrics, trace };
}

module.exports = { jobSequencingDeadlines };
