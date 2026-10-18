const {
  createServers,
  snapshotServers,
  computeMetrics,
  rebuildServersFromAssignments,
} = require('./metrics');

/** Branch-and-bound: assign each job to a server (n ≤ 12). */
function branchAndBound(jobs, config) {
  const { numServers, serverCpu, serverMemory } = config;
  const n = jobs.length;

  if (n > 12) {
    return {
      algorithm: 'branchBound',
      error: 'Branch and bound supports at most 12 jobs',
      assignments: [],
      metrics: null,
      trace: [{ action: 'error', message: 'n must be ≤ 12 for branch and bound' }],
      pruneCount: 0,
    };
  }

  const ordered = [...jobs].sort((a, b) => a.id - b.id);
  const remainingPriority = Array(n + 1);
  remainingPriority[n] = 0;
  for (let i = n - 1; i >= 0; i--) {
    remainingPriority[i] = remainingPriority[i + 1] + ordered[i].priority;
  }

  let bestPriority = -1;
  let bestAssignments = [];
  let pruneCount = 0;
  const trace = [];
  const treeNodes = [];
  let nodeId = 0;

  trace.push({
    action: 'init',
    message: `Branch & bound: ${n} jobs, ${numServers} servers`,
    servers: snapshotServers(createServers(numServers)),
    highlightJobId: null,
    treeNodes: [],
  });

  function bound(prioritySoFar, depth) {
    return prioritySoFar + remainingPriority[depth];
  }

  const MAX_TRACE = 800;

  function pushTrace(entry) {
    if (trace.length < MAX_TRACE) trace.push(entry);
  }

  function dfs(depth, prioritySoFar, serverStates, currentAssignments, pathNodeId) {
    if (bound(prioritySoFar, depth) <= bestPriority) {
      pruneCount += 1;
      treeNodes.push({
        id: nodeId++,
        parentId: pathNodeId,
        depth,
        label: 'prune (bound)',
        pruned: true,
      });
      pushTrace({
        action: 'prune',
        message: `Prune at depth ${depth}: bound ${bound(prioritySoFar, depth)} ≤ best ${bestPriority}`,
        depth,
        pruneCount,
        highlightJobId: depth < n ? ordered[depth].id : null,
        servers: snapshotFromStates(serverStates),
        treeNodes: snapshotTree(treeNodes),
      });
      return;
    }

    if (depth === n) {
      if (prioritySoFar > bestPriority) {
        bestPriority = prioritySoFar;
        bestAssignments = currentAssignments.map((a) => ({ ...a }));
        pushTrace({
          action: 'update_best',
          message: `New best priority ${bestPriority}`,
          priority: bestPriority,
          highlightJobId: null,
          servers: snapshotFromStates(serverStates),
          treeNodes: snapshotTree(treeNodes),
        });
      }
      return;
    }

    const job = ordered[depth];
    const thisNode = nodeId++;
    treeNodes.push({
      id: thisNode,
      parentId: pathNodeId,
      depth,
      label: `J${job.id}?`,
      pruned: false,
    });

    pushTrace({
      action: 'branch',
      message: `Branch on job ${job.id}`,
      jobId: job.id,
      depth,
      nodeId: thisNode,
      highlightJobId: job.id,
      servers: snapshotFromStates(serverStates),
      treeNodes: snapshotTree(treeNodes),
    });

    let anyChild = false;

    for (let si = 0; si < numServers; si++) {
      if (job.cpu > serverCpu || job.memory > serverMemory) continue;
      const st = serverStates[si];
      const startTime = Math.max(job.arrivalTime, st.freeTime);
      const endTime = startTime + job.duration;
      const missed = endTime > job.deadline;

      const nextStates = serverStates.map((s) => ({
        id: s.id,
        freeTime: s.freeTime,
        timeline: s.timeline.map((t) => ({ ...t })),
      }));
      const ns = nextStates[si];
      ns.freeTime = endTime;
      ns.timeline.push({
        jobId: job.id,
        startTime,
        endTime,
        cpu: job.cpu,
        memory: job.memory,
      });

      const childPriority = prioritySoFar + job.priority;
      const childAssign = [
        ...currentAssignments,
        {
          jobId: job.id,
          serverId: si + 1,
          startTime,
          endTime,
          waitTime: startTime - job.arrivalTime,
          missedDeadline: missed,
          priority: job.priority,
        },
      ];

      const childNode = nodeId++;
      treeNodes.push({
        id: childNode,
        parentId: thisNode,
        depth: depth + 1,
        label: `→S${si + 1}`,
        pruned: false,
      });

      pushTrace({
        action: 'place',
        message: `Try job ${job.id} on server ${si + 1} [${startTime},${endTime})`,
        jobId: job.id,
        serverId: si + 1,
        depth,
        highlightJobId: job.id,
        servers: snapshotFromStates(nextStates),
        treeNodes: snapshotTree(treeNodes),
      });

      anyChild = true;
      dfs(depth + 1, childPriority, nextStates, childAssign, childNode);
    }

    if (!anyChild) {
      pruneCount += 1;
      pushTrace({
        action: 'prune',
        message: `No feasible server for job ${job.id}`,
        jobId: job.id,
        depth,
        pruneCount,
        highlightJobId: job.id,
        servers: snapshotFromStates(serverStates),
        treeNodes: snapshotTree(treeNodes),
      });
    }
  }

  const initialStates = createServers(numServers).map((s) => ({
    id: s.id,
    freeTime: s.freeTime,
    timeline: [],
  }));

  dfs(0, 0, initialStates, [], 0);

  const servers = rebuildServersFromAssignments(
    numServers,
    bestAssignments,
    new Map(jobs.map((j) => [j.id, j]))
  );
  const rejected = jobs.length - bestAssignments.length;
  const metrics = computeMetrics(bestAssignments, jobs, servers, config, rejected);

  trace.push({
    action: 'done',
    message: `Branch & bound complete (${pruneCount} prunes)`,
    metrics,
    pruneCount,
    servers: snapshotServers(servers),
    treeNodes: snapshotTree(treeNodes),
  });

  return {
    algorithm: 'branchBound',
    assignments: bestAssignments,
    metrics,
    trace,
    pruneCount,
  };
}

function snapshotFromStates(states) {
  return states.map((s) => ({
    id: s.id,
    freeTime: s.freeTime,
    timeline: s.timeline.map((t) => ({ ...t })),
  }));
}

function snapshotTree(nodes) {
  return nodes.map((n) => ({ ...n }));
}

module.exports = { branchAndBound };
