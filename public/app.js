/**
 * Data Center Workload Optimizer — Front-End Application Controller
 * Features:
 * - Bespoke espresso black & warm beige theme
 * - Step-by-step trace simulation with stable timeline horizon
 * - Interactive Play/Pause with automatic replay on completion
 * - Default 0.5x simulation speed
 * - Live Job Manifest HUD (100% visibility for queued, running, and rejected jobs)
 * - 0/1 Knapsack 2D DP Table Visualizer
 * - Branch & Bound Search Tree with Pruning Counters
 * - Side-by-side Comparative Table with Winner Trophies 🏆
 * - Compact live benchmark chart
 */

/** @type {Array<object>|null} */
let jobs = null;
/** @type {Array<object>} */
let jobListForViz = [];
/** @type {object|null} */
let lastResult = null;
/** @type {object[]} */
let algorithmsMeta = [];
/** @type {object[]} */
let complexityRows = [];

let trace = [];
let stepIndex = 0;
let playTimer = null;

// DOM Elements
const statusEl = document.getElementById('status-message');
const perServerHint = document.getElementById('per-server-hint');
const jobsTbody = document.getElementById('jobs-tbody');
const jobCountBadge = document.getElementById('job-count-badge');
const metricsEl = document.getElementById('metrics');
const btnRun = document.getElementById('btn-run');
const btnCompare = document.getElementById('btn-compare');
const algorithmSelect = document.getElementById('algorithm-select');

// Simulation Controls
const stepCaption = document.getElementById('step-caption');
const stepIcon = document.getElementById('step-icon');
const stepIndicator = document.getElementById('step-indicator');
const stepActionBadge = document.getElementById('step-action-badge');
const traceScrubber = document.getElementById('trace-scrubber');
const serverViz = document.getElementById('server-viz');
const ganttRuler = document.getElementById('gantt-timeline-ruler');
const auxViz = document.getElementById('aux-viz');
const auxTitle = document.getElementById('aux-title');
const auxSubtitle = document.getElementById('aux-subtitle');

// Job HUD elements
const hudJobChips = document.getElementById('hud-job-chips');
const hudWaitCount = document.getElementById('hud-wait-count');
const hudRunCount = document.getElementById('hud-run-count');
const hudRejCount = document.getElementById('hud-rej-count');

const btnStepStart = document.getElementById('btn-step-start');
const btnStepBack = document.getElementById('btn-step-back');
const btnPlay = document.getElementById('btn-play');
const btnPause = document.getElementById('btn-pause');
const btnStepFwd = document.getElementById('btn-step-fwd');
const btnStepEnd = document.getElementById('btn-step-end');
const speedRange = document.getElementById('speed-range');
const speedLabel = document.getElementById('speed-label');

let benchmarkChart = null;

// Warm Earthy Theme Palette
const COLORS = {
  fcfs: '#d4a373',
  sjf: '#8a9a86',
  deadlines: '#d99b43',
  knapsack: '#c58f59',
  heap: '#b8824f',
  branchBound: '#c86d5e',
};

const ACTION_ICONS = {
  init: '⚡',
  consider: '🔍',
  place: '⚙️',
  enqueue: '📥',
  reject: '❌',
  dp_fill: '🧮',
  dp_row: '📋',
  dp_backtrack: '🔙',
  knapsack_done: '✨',
  branch: '🌿',
  prune: '✂️',
  update_best: '🏆',
  done: '✅',
  error: '⚠️',
};

// Speed Mapping (Default 0.5x at index 2)
const SPEED_MAP = {
  1: { label: '0.25x', delay: 1200 },
  2: { label: '0.5x', delay: 800 },   // DEFAULT
  3: { label: '0.75x', delay: 550 },
  4: { label: '1.0x', delay: 400 },
  5: { label: '1.5x', delay: 260 },
  6: { label: '2.0x', delay: 180 },
  7: { label: '3.0x', delay: 120 },
  8: { label: '5.0x', delay: 70 },
  9: { label: '7.5x', delay: 40 },
  10: { label: '10x', delay: 20 },
};

const PAIRS = [
  ['n', 5, 200],
  ['totalCpu', 4, 64],
  ['totalMemory', 8, 256],
  ['numServers', 1, 8],
];

function clampInt(value, min, max) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function bindRangePair(name, min, max) {
  const range = document.getElementById(`${name}-range`);
  const input = document.getElementById(`${name}-input`);
  if (!range || !input) return;
  range.addEventListener('input', () => {
    input.value = range.value;
    updatePerServerHint();
  });
  input.addEventListener('input', () => {
    const v = clampInt(input.value, min, max);
    input.value = v;
    range.value = v;
    updatePerServerHint();
  });
}

PAIRS.forEach(([name, min, max]) => bindRangePair(name, min, max));
['totalCpu', 'totalMemory', 'numServers'].forEach((id) => {
  document.getElementById(`${id}-input`)?.addEventListener('input', updatePerServerHint);
});

// Presets
const PRESETS = {
  default: { n: 15, totalCpu: 16, totalMemory: 64, numServers: 3, seed: 42 },
  knapsack: { n: 12, totalCpu: 16, totalMemory: 48, numServers: 2, seed: 101 },
  branch: { n: 8, totalCpu: 16, totalMemory: 48, numServers: 2, seed: 77 },
  large: { n: 80, totalCpu: 32, totalMemory: 128, numServers: 4, seed: 555 },
};

function applyPreset(p) {
  for (const [key, val] of Object.entries(p)) {
    const inp = document.getElementById(`${key}-input`);
    const rng = document.getElementById(`${key}-range`);
    if (inp) inp.value = val;
    if (rng) rng.value = val;
  }
  updatePerServerHint();
  document.getElementById('btn-generate').click();
}

document.getElementById('preset-default')?.addEventListener('click', () => applyPreset(PRESETS.default));
document.getElementById('preset-knapsack')?.addEventListener('click', () => applyPreset(PRESETS.knapsack));
document.getElementById('preset-branch')?.addEventListener('click', () => applyPreset(PRESETS.branch));
document.getElementById('preset-large')?.addEventListener('click', () => applyPreset(PRESETS.large));

document.getElementById('btn-random-seed')?.addEventListener('click', () => {
  const seedInput = document.getElementById('seed-input');
  seedInput.value = Math.floor(Math.random() * 900000) + 1000;
  document.getElementById('btn-generate').click();
});

function readConfigFromForm() {
  return {
    n: clampInt(document.getElementById('n-input')?.value || 15, 5, 200),
    totalCpu: clampInt(document.getElementById('totalCpu-input')?.value || 16, 4, 64),
    totalMemory: clampInt(document.getElementById('totalMemory-input')?.value || 64, 8, 256),
    numServers: clampInt(document.getElementById('numServers-input')?.value || 3, 1, 8),
    seed: clampInt(document.getElementById('seed-input')?.value || 42, 0, 999999999),
    cpuMin: clampInt(document.getElementById('cpuMin-input')?.value || 1, 1, 128),
    cpuMax: clampInt(document.getElementById('cpuMax-input')?.value || 4, 1, 128),
    memoryMin: clampInt(document.getElementById('memoryMin-input')?.value || 2, 1, 512),
    memoryMax: clampInt(document.getElementById('memoryMax-input')?.value || 8, 1, 512),
    durationMin: clampInt(document.getElementById('durationMin-input')?.value || 2, 1, 100),
    durationMax: clampInt(document.getElementById('durationMax-input')?.value || 8, 1, 100),
    deadlineMin: clampInt(document.getElementById('deadlineMin-input')?.value || 5, 1, 500),
    deadlineMax: clampInt(document.getElementById('deadlineMax-input')?.value || 25, 1, 500),
    priorityMin: clampInt(document.getElementById('priorityMin-input')?.value || 1, 1, 10),
    priorityMax: clampInt(document.getElementById('priorityMax-input')?.value || 10, 1, 10),
  };
}

function updatePerServerHint() {
  const c = readConfigFromForm();
  const cpu = Math.max(1, Math.floor(c.totalCpu / c.numServers));
  const mem = Math.max(1, Math.floor(c.totalMemory / c.numServers));
  perServerHint.textContent = `Node capacity: ${cpu} cores CPU, ${mem} GB RAM per server (${c.numServers} nodes).`;
}

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle('error', isError);
}

function renderJobsTable(list) {
  if (jobsTbody) {
    jobsTbody.innerHTML = '';
    if (jobCountBadge) jobCountBadge.textContent = `${list.length} jobs`;
    if (!list.length) {
      jobsTbody.innerHTML = '<tr class="empty-row"><td colspan="7">No jobs generated.</td></tr>';
      renderJobHud([]);
      return;
    }
    for (const job of list) {
      const tr = document.createElement('tr');
      tr.dataset.jobId = String(job.id);
      for (const field of ['id', 'arrivalTime', 'cpu', 'memory', 'duration', 'deadline', 'priority']) {
        const td = document.createElement('td');
        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'cell-input';
        input.dataset.field = field;
        input.value = job[field];
        if (field === 'id') input.readOnly = true;
        td.appendChild(input);
        tr.appendChild(td);
      }
      jobsTbody.appendChild(tr);
    }
  }
  renderJobHud(list);
}

function readJobsFromTable() {
  if (!jobsTbody) return jobs || [];
  const rows = [...jobsTbody.querySelectorAll('tr[data-job-id]')];
  if (!rows.length) return jobs || [];
  return rows.map((tr) => {
    const get = (field) => Number(tr.querySelector(`input[data-field="${field}"]`).value);
    return {
      id: get('id'),
      arrivalTime: get('arrivalTime'),
      cpu: get('cpu'),
      memory: get('memory'),
      duration: get('duration'),
      deadline: get('deadline'),
      priority: get('priority'),
    };
  });
}

function renderJobHud(list, step = null) {
  if (!hudJobChips) return;
  if (!list || !list.length) {
    hudJobChips.innerHTML = '<span class="hint">No jobs in manifest.</span>';
    hudWaitCount.textContent = 'Queued: 0';
    hudRunCount.textContent = 'Scheduled: 0';
    hudRejCount.textContent = 'Rejected: 0';
    return;
  }

  // Find job states from current step
  const scheduledMap = new Map();
  const rejectedSet = new Set();
  const activeJobId = step?.highlightJobId ?? null;

  if (step?.servers) {
    for (const s of step.servers) {
      for (const b of s.timeline) {
        scheduledMap.set(b.jobId, s.id);
      }
    }
  }

  // Look through previous steps up to stepIndex for rejections
  if (trace && trace.length) {
    const curIdx = Math.min(stepIndex, trace.length - 1);
    for (let i = 0; i <= curIdx; i++) {
      if (trace[i].action === 'reject' && trace[i].jobId != null) {
        rejectedSet.add(trace[i].jobId);
      }
    }
  }

  let waitCount = 0;
  let runCount = scheduledMap.size;
  let rejCount = rejectedSet.size;

  const chipsHtml = list.map((job) => {
    const isScheduled = scheduledMap.has(job.id);
    const isRejected = rejectedSet.has(job.id);
    const isActive = activeJobId === job.id;

    let statusClass = 'status-queued';
    let statusText = 'Queued';

    if (isActive) {
      statusClass = 'status-active';
      statusText = 'Active';
    } else if (isScheduled) {
      statusClass = 'status-scheduled';
      statusText = `S${scheduledMap.get(job.id)}`;
    } else if (isRejected) {
      statusClass = 'status-rejected';
      statusText = 'Dropped';
    } else {
      waitCount++;
    }

    return `<div class="job-hud-item ${statusClass}" title="Job ${job.id} | Arr: ${job.arrivalTime} | Dur: ${job.duration} | Prio: ${job.priority}">
      <strong>J${job.id}</strong>: ${statusText}
    </div>`;
  }).join('');

  hudJobChips.innerHTML = chipsHtml;
  hudWaitCount.textContent = `Queued: ${list.length - runCount - rejCount}`;
  hudRunCount.textContent = `Scheduled: ${runCount}`;
  hudRejCount.textContent = `Rejected: ${rejCount}`;
}

function renderMetrics(result) {
  if (!result?.metrics) {
    metricsEl.innerHTML = `<p class="hint error-text">${result?.error || 'No metrics'}</p>`;
    return;
  }
  const m = result.metrics;
  const cards = [
    ['Jobs completed', `${m.jobsCompleted} / ${m.jobsTotal}`, `${((m.jobsCompleted / (m.jobsTotal || 1)) * 100).toFixed(0)}% completion`],
    ['Total priority', String(m.totalPriority), 'Sum of completed job weights'],
    ['Avg wait time', `${m.averageWaitTime} units`, 'Time queued before start'],
    ['Cluster utilization', `${(m.serverUtilization * 100).toFixed(1)}%`, 'Active compute efficiency'],
    ['Deadline misses', String(m.deadlineMisses), `${m.rejected} rejected / capacity`],
    ['Energy consumed', `${m.totalEnergyKwh ?? '0.00'} kWh`, 'Idle + dynamic server power'],
    ['Green efficiency', `${m.energyEfficiency ?? '—'} prio/kWh`, 'Eco-workload optimization'],
    ['Runtime (wall-clock)', `${(result.runtimeMs ?? 0).toFixed(3)} ms`, 'Measured server compute'],
  ];
  if (result.pruneCount != null) {
    cards.push(['B&B branches pruned', String(result.pruneCount), 'Subtrees cut by upper bound']);
  }
  metricsEl.innerHTML = cards
    .map(
      ([label, value, sub]) =>
        `<div class="metric-card"><span class="metric-label">${label}</span><span class="metric-value">${value}</span><span class="metric-sub">${sub}</span></div>`
    )
    .join('');
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    const detail = data.details ? data.details.join('; ') : data.error || res.statusText;
    throw new Error(detail);
  }
  return data;
}

function stopPlayback() {
  if (playTimer) {
    clearInterval(playTimer);
    playTimer = null;
  }
  btnPlay.classList.remove('active');
  btnPlay.textContent = '▶ Play';
  btnPause.classList.remove('active');
}

function setAnimControlsEnabled(on) {
  if (btnPlay) btnPlay.disabled = !on;
  if (btnPause) btnPause.disabled = !on;
  if (btnStepStart) btnStepStart.disabled = !on;
  if (btnStepBack) btnStepBack.disabled = !on;
  if (btnStepFwd) btnStepFwd.disabled = !on;
  if (btnStepEnd) btnStepEnd.disabled = !on;
  if (traceScrubber) traceScrubber.disabled = !on;
}

function loadTrace(result) {
  lastResult = result;
  trace = result.trace || [];
  stepIndex = 0;
  stopPlayback();
  traceScrubber.max = Math.max(0, trace.length - 1);
  traceScrubber.value = 0;
  setAnimControlsEnabled(trace.length > 0);
  renderStep();
}

function renderStep() {
  if (!trace.length) {
    stepCaption.textContent = 'No trace available for this algorithm.';
    stepActionBadge.textContent = 'Idle';
    stepActionBadge.className = 'action-badge';
    stepIcon.textContent = '💡';
    serverViz.innerHTML = '<p class="hint empty-gantt">No trace data.</p>';
    auxViz.innerHTML = '';
    renderJobHud(jobListForViz, null);
    return;
  }
  stepIndex = Math.max(0, Math.min(stepIndex, trace.length - 1));
  traceScrubber.value = stepIndex;
  const step = trace[stepIndex];

  stepCaption.textContent = step.message || step.action;
  stepIndicator.textContent = `Step ${stepIndex + 1} / ${trace.length}`;
  stepActionBadge.textContent = step.action.replace('_', ' ');
  stepActionBadge.className = `action-badge badge-${step.action}`;
  stepIcon.textContent = ACTION_ICONS[step.action] || '⚡';

  highlightJobRow(step.highlightJobId);
  renderServerViz(step);
  renderAuxViz(step);
  renderJobHud(jobListForViz, step);

  if (step.action === 'done' && step.metrics) {
    renderMetrics({ ...lastResult, metrics: step.metrics });
  }
}

function highlightJobRow(jobId) {
  if (!jobsTbody) return;
  jobsTbody.querySelectorAll('tr[data-job-id]').forEach((tr) => {
    tr.classList.toggle('highlight', jobId != null && tr.dataset.jobId === String(jobId));
  });
}

function renderServerViz(step) {
  const servers = step.servers || [];
  if (!servers.length) {
    serverViz.innerHTML = '<p class="hint empty-gantt">Server allocations will appear as steps execute.</p>';
    ganttRuler.innerHTML = '';
    return;
  }

  // Stable Horizon: calculate from final result makespan so the timeline doesn't jump
  let finalMakespan = lastResult?.metrics?.makespan || 0;
  for (const s of servers) {
    for (const b of s.timeline) finalMakespan = Math.max(finalMakespan, b.endTime);
  }
  const horizon = Math.max(finalMakespan, 1);

  // Render timeline ruler ticks
  const tickStep = horizon <= 20 ? 2 : horizon <= 60 ? 5 : 10;
  let rulerHtml = '';
  for (let t = 0; t <= horizon; t += tickStep) {
    const left = (t / horizon) * 100;
    rulerHtml += `<span class="ruler-tick" style="left:${left}%">${t}</span>`;
  }
  ganttRuler.innerHTML = rulerHtml;

  serverViz.innerHTML = servers
    .map((s) => {
      let activeJobsCount = 0;
      let totalTimeActive = 0;
      const blocks = s.timeline
        .map((b) => {
          totalTimeActive += b.endTime - b.startTime;
          activeJobsCount++;
          const job = jobListForViz.find((j) => j.id === b.jobId);
          const left = (b.startTime / horizon) * 100;
          const width = Math.max(((b.endTime - b.startTime) / horizon) * 100, 2.5);
          const isCurrent = step.highlightJobId === b.jobId;
          const hl = isCurrent ? ' block-hl' : '';
          
          let priorityClass = 'p-low';
          if (job) {
            if (job.priority >= 8) priorityClass = 'p-high';
            else if (job.priority >= 4) priorityClass = 'p-med';
          }
          if (isCurrent) priorityClass = 'p-active';

          const title = job
            ? `Job ${b.jobId} | [${b.startTime} - ${b.endTime}) | CPU: ${job.cpu} | RAM: ${job.memory}GB | Prio: ${job.priority}`
            : `Job ${b.jobId}`;

          return `<div class="job-block ${priorityClass}${hl}" style="left:${left}%;width:${width}%" title="${title}">
            <span>J${b.jobId}</span>
          </div>`;
        })
        .join('');

      const util = horizon > 0 ? ((totalTimeActive / horizon) * 100).toFixed(0) : 0;
      return `<div class="server-row">
        <div class="server-info">
          <span class="server-name">Server ${s.id}</span>
          <span class="server-load-badge">${util}% busy</span>
        </div>
        <div class="server-track">${blocks}</div>
        <span class="server-meta">free @ ${s.freeTime}</span>
      </div>`;
    })
    .join('');
}

function renderAuxViz(step) {
  const currentAlgo = algorithmSelect.value;

  if (currentAlgo === 'knapsack') {
    auxTitle.textContent = '0/1 Knapsack Dynamic Programming Matrix';
    auxSubtitle.textContent = 'Rows = Jobs, Columns = CPU Capacity, Values = Max Priority';
    renderKnapsackAux(step);
  } else if (currentAlgo === 'branchBound') {
    auxTitle.textContent = 'Branch & Bound DFS Assignment Search Tree';
    auxSubtitle.textContent = 'Depth-First Exploration with Upper-Bound Pruning';
    renderBranchBoundAux(step);
  } else if (currentAlgo === 'heap') {
    auxTitle.textContent = 'Dual Heap Priority Engine';
    auxSubtitle.textContent = 'Max-Heap (Jobs by Priority) + Min-Heap (Servers by Free Time)';
    renderHeapAux(step);
  } else if (currentAlgo === 'deadlines') {
    auxTitle.textContent = 'Disjoint-Set (Union-Find) Slot Allocation';
    auxSubtitle.textContent = 'Finds latest available slot before job deadline';
    renderDeadlinesAux(step);
  } else {
    auxTitle.textContent = 'Algorithm Execution View';
    auxSubtitle.textContent = 'Greedy scheduling & state tracking';
    auxViz.innerHTML = `<div class="dp-formula-banner">
      <span>Executing <strong>${currentAlgo.toUpperCase()}</strong>: Scheduling jobs in greedy priority sequence.</span>
    </div>`;
  }
}

function renderKnapsackAux(step) {
  const grid = lastResult?.finalDp || [];

  let formula = 'DP[i][w] = max( DP[i-1][w], DP[i-1][w - cpu_i] + prio_i )';
  if (step.action === 'dp_fill') {
    const job = jobListForViz.find((j) => j.id === step.jobId) || {};
    formula = `DP[J${step.jobId}][w=${step.w}] = ${step.took ? `TAKE (${step.value})` : `SKIP (${step.value})`} | Job CPU=${job.cpu}, Prio=${job.priority}`;
  } else if (step.action === 'dp_backtrack') {
    formula = `Backtracking at [Job ${step.i}][Cap ${step.w}] ➔ ${step.message}`;
  }

  let html = `<div class="dp-container">
    <div class="dp-formula-banner">
      <span>Recurrence Equation:</span>
      <span class="dp-formula-math">${formula}</span>
    </div>`;

  if (grid.length > 0) {
    html += '<div class="dp-table-wrap"><table class="dp-table"><thead><tr><th class="dp-row-hdr">Job \\ Cap</th>';
    for (let w = 0; w < grid[0].length; w++) {
      html += `<th>${w}</th>`;
    }
    html += '</tr></thead><tbody>';

    const backtrackSet = new Set();
    if (step.backtrackPath) {
      step.backtrackPath.forEach((pt) => backtrackSet.add(`${pt.i},${pt.w}`));
    } else if (lastResult?.backtrackPath) {
      lastResult.backtrackPath.forEach((pt) => backtrackSet.add(`${pt.i},${pt.w}`));
    }

    for (let r = 0; r < grid.length; r++) {
      const jobLabel = r === 0 ? 'Base' : `J${jobListForViz[r - 1]?.id ?? r}`;
      html += `<tr><th class="dp-row-hdr">${jobLabel}</th>`;
      for (let c = 0; c < grid[r].length; c++) {
        const isActive = step.i === r && step.w === c;
        const isBacktrack = backtrackSet.has(`${r},${c}`);
        let cellClass = '';
        if (isActive) cellClass = ' dp-cell-active';
        else if (isBacktrack) cellClass = ' dp-cell-backtrack';
        else if (grid[r][c] > (r > 0 ? grid[r - 1][c] : 0)) cellClass = ' dp-cell-taken';

        html += `<td class="${cellClass}">${grid[r][c]}</td>`;
      }
      html += '</tr>';
    }
    html += '</tbody></table></div></div>';
  } else {
    html += '<p class="hint">DP table being populated…</p></div>';
  }

  auxViz.innerHTML = html;
}

function renderBranchBoundAux(step) {
  const nodes = step.treeNodes || (lastResult?.trace && lastResult.trace[lastResult.trace.length - 1]?.treeNodes) || [];
  const pruneCount = step.pruneCount ?? lastResult?.pruneCount ?? 0;

  let html = `<div class="bb-container">
    <div class="bb-stats-bar">
      <div class="bb-stat"><span>✂️ Subtrees Pruned:</span> <span class="bb-stat-val">${pruneCount}</span></div>
      <div class="bb-stat"><span>Upper Bound:</span> <span class="bb-stat-val">PrioritySoFar + RemPrio ≤ Best</span></div>
    </div>
    <div class="bb-tree-scroll">`;

  if (!nodes.length) {
    html += '<p class="hint">Search tree will expand during branch-and-bound traversal.</p>';
  } else {
    html += nodes
      .map((n) => {
        let pillClass = n.pruned ? 'pruned' : 'active';
        if (n.label?.includes('best') || n.label?.includes('🏆')) pillClass = 'best';
        const indent = Math.min(n.depth * 18, 300);
        return `<div class="bb-node-row" style="padding-left:${indent}px">
          <span class="bb-node-pill ${pillClass}">
            ${n.pruned ? '✂ ' : ''}${n.label}
          </span>
          <span class="bb-node-action">${n.pruned ? 'Branch pruned (bound cannot beat best)' : ''}</span>
        </div>`;
      })
      .join('');
  }
  html += '</div></div>';
  auxViz.innerHTML = html;
}

function renderHeapAux(step) {
  auxViz.innerHTML = `<div class="dp-formula-banner">
    <div><strong>Dual Heap Architecture:</strong></div>
    <div>1. <strong>Job Priority Queue:</strong> Max-Heap extracting highest priority ready job.</div>
    <div>2. <strong>Server Availability Queue:</strong> Min-Heap extracting earliest available server node.</div>
  </div>`;
}

function renderDeadlinesAux(step) {
  auxViz.innerHTML = `<div class="dp-formula-banner">
    <div><strong>Disjoint Set (Union-Find) Timeline Slots:</strong></div>
    <div>Sorts jobs descending by priority. For each job, finds the latest free time slot before its deadline using path-compressed <code>find(slot)</code> in O(α(D)) amortized time.</div>
  </div>`;
}

function getDelayFromSlider() {
  const val = Number(speedRange.value);
  return SPEED_MAP[val]?.delay || 800;
}

speedRange.addEventListener('input', () => {
  const val = Number(speedRange.value);
  const cfg = SPEED_MAP[val] || { label: '0.5x', delay: 800 };
  speedLabel.textContent = cfg.label;
  if (playTimer) {
    stopPlayback();
    btnPlay.click();
  }
});

// Robust Play Button
btnPlay.addEventListener('click', () => {
  if (!trace.length) return;
  // If at the end, restart from beginning
  if (stepIndex >= trace.length - 1) {
    stepIndex = 0;
    renderStep();
  }

  stopPlayback();
  btnPlay.classList.add('active');
  btnPause.classList.remove('active');
  btnPlay.textContent = '▶ Playing';

  playTimer = setInterval(() => {
    if (stepIndex >= trace.length - 1) {
      stopPlayback();
      return;
    }
    stepIndex += 1;
    renderStep();
  }, getDelayFromSlider());
});

// Robust Pause Button
btnPause.addEventListener('click', () => {
  stopPlayback();
  btnPause.classList.add('active');
});

btnStepStart.addEventListener('click', () => {
  stopPlayback();
  stepIndex = 0;
  renderStep();
});

btnStepEnd.addEventListener('click', () => {
  stopPlayback();
  stepIndex = trace.length - 1;
  renderStep();
});

if (btnStepFwd) {
  btnStepFwd.addEventListener('click', () => {
    stopPlayback();
    stepIndex += 1;
    renderStep();
  });
}

if (btnStepBack) {
  btnStepBack.addEventListener('click', () => {
    stopPlayback();
    stepIndex -= 1;
    renderStep();
  });
}

traceScrubber.addEventListener('input', () => {
  stopPlayback();
  stepIndex = Number(traceScrubber.value);
  renderStep();
});

// Generate Jobs
document.getElementById('btn-generate').addEventListener('click', async () => {
  setStatus('Generating synthetic data center jobs…');
  try {
    const config = readConfigFromForm();
    const data = await postJson('/api/generate-jobs', config);
    jobs = data.jobs;
    jobListForViz = [...jobs];
    renderJobsTable(jobs);
    btnRun.disabled = false;
    btnCompare.disabled = false;
    metricsEl.innerHTML = '<p class="hint">Ready to run. Choose an algorithm above.</p>';
    serverViz.innerHTML = '<p class="hint empty-gantt">Click "Run & Animate" to schedule generated jobs.</p>';
    auxViz.innerHTML = '';
    trace = [];
    setAnimControlsEnabled(false);
    setStatus(`Generated ${jobs.length} jobs (deterministic seed ${config.seed}).`);
  } catch (e) {
    setStatus(e.message, true);
  }
});

// Run Algorithm
btnRun.addEventListener('click', async () => {
  if (!jobs?.length) return;
  const algo = algorithmSelect.value;
  setStatus(`Executing ${algo} algorithm…`);
  try {
    jobListForViz = readJobsFromTable();
    const payload = { jobs: jobListForViz, config: readConfigFromForm() };
    const result = await postJson(`/api/run/${algo}`, payload);
    if (result.error) throw new Error(result.error);
    renderMetrics(result);
    loadTrace(result);
    setStatus(`Finished ${algo} execution in ${(result.runtimeMs ?? 0).toFixed(3)} ms.`);
  } catch (e) {
    setStatus(e.message, true);
  }
});

// Compare All Algorithms
btnCompare.addEventListener('click', async () => {
  if (!jobs?.length) return;
  setStatus('Comparing all algorithms on current job pool…');
  try {
    const payload = { jobs: readJobsFromTable(), config: readConfigFromForm() };
    const data = await postJson('/api/compare', payload);
    renderCompareTable(data.results);
    document.getElementById('compare-panel').classList.remove('hidden');
    setStatus('Comparative analysis complete.');
  } catch (e) {
    setStatus(e.message, true);
  }
});

const METRIC_KEYS = [
  { key: 'totalPriority', label: 'Total Priority Served', higherBetter: true },
  { key: 'jobsCompleted', label: 'Completed Jobs', higherBetter: true },
  { key: 'averageWaitTime', label: 'Average Wait Time', higherBetter: false },
  { key: 'serverUtilization', label: 'Cluster Utilization', higherBetter: true },
  { key: 'deadlineMisses', label: 'Deadline Misses', higherBetter: false },
  { key: 'totalEnergyKwh', label: 'Energy Consumed (kWh)', higherBetter: false },
  { key: 'energyEfficiency', label: 'Green Efficiency (Prio/kWh)', higherBetter: true },
  { key: 'runtimeMs', label: 'Wall-clock Runtime (ms)', higherBetter: false },
];

function renderCompareTable(results) {
  const thead = document.querySelector('#compare-table thead');
  const tbody = document.querySelector('#compare-table tbody');
  const ids = Object.keys(results);
  thead.innerHTML = `<tr><th>Evaluation Metric</th>${ids.map((id) => `<th>${results[id].label}</th>`).join('')}</tr>`;

  const winners = {};
  for (const mk of METRIC_KEYS) {
    let best = null;
    let bestId = null;
    for (const id of ids) {
      const r = results[id];
      if (r.error || !r.metrics) continue;
      const val = mk.key === 'runtimeMs' ? r.runtimeMs : r.metrics[mk.key];
      if (val == null) continue;
      if (best == null || (mk.higherBetter ? val > best : val < best)) {
        best = val;
        bestId = id;
      }
    }
    winners[mk.key] = bestId;
  }

  tbody.innerHTML = METRIC_KEYS.map((mk) => {
    const cells = ids
      .map((id) => {
        const r = results[id];
        if (r.error) return `<td class="err">${r.error}</td>`;
        const rawVal = mk.key === 'runtimeMs' ? r.runtimeMs : r.metrics?.[mk.key];
        const isWin = winners[mk.key] === id;
        const winClass = isWin ? ' winner' : '';
        const trophy = isWin ? ' 🏆' : '';
        
        let display = rawVal ?? '—';
        if (mk.key === 'runtimeMs' && rawVal != null) display = `${rawVal.toFixed(3)} ms`;
        if (mk.key === 'serverUtilization' && rawVal != null) display = `${(rawVal * 100).toFixed(1)}%`;
        if (mk.key === 'totalEnergyKwh' && rawVal != null) display = `${rawVal} kWh`;
        if (mk.key === 'energyEfficiency' && rawVal != null) display = `${rawVal}`;

        return `<td class="${winClass}">${display}${trophy}</td>`;
      })
      .join('');
    return `<tr><th>${mk.label}</th>${cells}</tr>`;
  }).join('');
}

function renderComplexityTable() {
  const tbody = document.getElementById('complexity-tbody');
  tbody.innerHTML = complexityRows
    .map((row) => {
      const meta = algorithmsMeta.find((a) => a.id === row.id);
      return `<tr>
        <td><strong>${meta?.label || row.id}</strong></td>
        <td><code>${row.time}</code></td>
        <td><code>${row.space}</code></td>
        <td>${row.note}</td>
      </tr>`;
    })
    .join('');
}

// Asymptotic Theory Curves
function theoryCurve(ns, kind, scale) {
  return ns.map((x) => {
    let y;
    switch (kind) {
      case 'n':
        y = x;
        break;
      case 'nlogn':
        y = x * Math.log2(Math.max(x, 2));
        break;
      case 'n2':
        y = x * x;
        break;
      case 'ncm':
        y = x * 16;
        break;
      case 'exp':
        y = Math.pow(2, Math.min(x, 15));
        break;
      default:
        y = x;
    }
    return y * scale;
  });
}

const THEORY_MAP = {
  fcfs: 'n',
  sjf: 'nlogn',
  deadlines: 'n2',
  knapsack: 'ncm',
  heap: 'nlogn',
  branchBound: 'exp',
};

// Benchmark runner
document.getElementById('btn-benchmark').addEventListener('click', async () => {
  const ns = [...document.querySelectorAll('.bench-n:checked')].map((el) => Number(el.value));
  if (!ns.length) {
    setStatus('Please select at least one value of n to benchmark.', true);
    return;
  }
  setStatus(`Benchmarking algorithms across n = [${ns.join(', ')}]…`);
  try {
    const data = await postJson('/api/benchmark', { ns, config: readConfigFromForm() });
    renderBenchmarkChart(data.series, ns);
    setStatus('Benchmark execution complete. Live vs theoretical curves plotted.');
  } catch (e) {
    setStatus(e.message, true);
  }
});

function renderBenchmarkChart(series, ns) {
  const ctx = document.getElementById('benchmark-chart');
  if (benchmarkChart) benchmarkChart.destroy();

  const datasets = [];
  for (const [id, s] of Object.entries(series)) {
    const points = s.points.filter((p) => !p.skipped && p.runtimeMs != null);
    if (!points.length) continue;

    const first = points[0];
    const theoreticalBase = theoryCurve([first.n], THEORY_MAP[id] || 'n', 1)[0];
    const scale = first.runtimeMs / Math.max(theoreticalBase, 1e-6);

    // Measured wall-clock time
    datasets.push({
      label: `${s.label} (Measured)`,
      data: points.map((p) => ({ x: p.n, y: p.runtimeMs })),
      borderColor: COLORS[id] || '#d4a373',
      backgroundColor: COLORS[id] || '#d4a373',
      tension: 0.2,
      pointRadius: 4,
      pointHoverRadius: 6,
    });

    // Scaled asymptotic theoretical curve
    datasets.push({
      label: `${s.label} (Theory O(${THEORY_MAP[id]}))`,
      data: ns.map((n) => ({ x: n, y: theoryCurve([n], THEORY_MAP[id] || 'n', scale)[0] })),
      borderColor: COLORS[id] || '#d4a373',
      borderDash: [5, 4],
      pointRadius: 0,
      tension: 0.2,
    });
  }

  benchmarkChart = new Chart(ctx, {
    type: 'line',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      parsing: false,
      plugins: {
        legend: {
          labels: {
            color: '#d4c4b0',
            boxWidth: 12,
            font: { size: 11 },
            filter: (item) => !item.text.includes('Theory') || item.datasetIndex % 2 === 1,
          },
        },
        tooltip: {
          backgroundColor: '#1b1815',
          titleColor: '#f5efe6',
          bodyColor: '#d4c4b0',
          borderColor: '#383028',
          borderWidth: 1,
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${Number(ctx.raw.y).toFixed(3)} ms (at n=${ctx.raw.x})`,
          },
        },
      },
      scales: {
        x: {
          type: 'linear',
          title: { display: true, text: 'Number of Jobs (n)', color: '#9c8e7c', font: { size: 11 } },
          ticks: { color: '#9c8e7c' },
          grid: { color: '#2b251f' },
        },
        y: {
          title: { display: true, text: 'Execution Time (ms)', color: '#9c8e7c', font: { size: 11 } },
          ticks: { color: '#9c8e7c' },
          grid: { color: '#2b251f' },
        },
      },
    },
  });
}

async function initMeta() {
  const res = await fetch('/api/algorithms');
  const data = await res.json();
  algorithmsMeta = data.algorithms;
  complexityRows = data.complexity;
  algorithmSelect.innerHTML = algorithmsMeta
    .map((a) => `<option value="${a.id}">${a.label} (${a.maxN ? `max n=${a.maxN}` : ''})</option>`)
    .join('');
  renderComplexityTable();

  // Set default speed label
  speedLabel.textContent = SPEED_MAP[2].label; // '0.5x'

  // Auto-generate initial job set
  document.getElementById('btn-generate').click();
}

initMeta().catch((e) => setStatus(e.message, true));
updatePerServerHint();
