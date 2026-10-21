# Data Center Workload Optimizer — DAA Project

A comprehensive web-based application built for the **Design and Analysis of Algorithms (DAA)** course curriculum. It simulates a modern cloud data center with finite multi-resource constraints (CPU cores and RAM) across parallel server nodes, demonstrating six core algorithmic paradigms, live step-by-step trace animations, side-by-side performance comparisons, and empirical vs. theoretical Big-O complexity analysis.

---

## 🚀 Quick Start

### Prerequisites
- Node.js (v18+ recommended)
- npm

### Installation & Launch
```bash
# 1. Install dependencies
npm install

# 2. Start the Express server
node server.js
```

Open your browser and navigate to:
```
http://localhost:3000
```

---

## 🏗️ Architecture & Project Structure

The project strictly separates algorithmic logic, backend endpoints, and client-side visualization:

```
DAA/
├── server.js                 # Express server with RESTful API endpoints
├── package.json              # Project metadata & Express dependency
├── README.md                 # Project documentation & DAA algorithm notes
├── algorithms/
│   ├── index.js              # Central registry & Big-O complexity definitions
│   ├── generator.js          # Deterministic pseudorandom job generator (seeded LCG)
│   ├── validate.js           # Input validation for requests and edge cases
│   ├── metrics.js            # Scheduling metrics & Green Computing Power model
│   ├── fcfs.js               # Algorithm 1: First-Come First-Served baseline
│   ├── sjf.js                # Algorithm 2: Greedy Shortest-Job-First
│   ├── deadlines.js          # Algorithm 3: Job Sequencing with Deadlines (Disjoint-Set)
│   └── knapsack.js           # Algorithm 4: 0/1 Knapsack DP (2D Table & Backtracking)
├── public/
│   ├── index.html            # Semantic HTML5 UI shell with glassmorphism layout
│   ├── app.js                # Interactive simulation player, scrubber & Chart.js logic
│   └── style.css             # Rich dark theme, animations, and Gantt styling
└── scripts/
    └── smoke.js              # Command-line test runner verifying all 4 algorithms
```

---

## 🧮 Algorithms & Theoretical Complexity

| Algorithm | DAA Paradigm | Time Complexity | Space Complexity | Mathematical Invariant & Mechanism |
|---|---|---|---|---|
| **FCFS** | Baseline Queue | $O(n \cdot s)$ | $O(n + s)$ | Assigns jobs in strict arrival order to the first server with sufficient room. |
| **Greedy SJF** | Greedy | $O(n \log n + n \cdot s)$ | $O(n + s)$ | Sorts jobs by ascending duration; places each job on the server that frees earliest to minimize average wait time. |
| **Job Sequencing with Deadlines** | Greedy + Disjoint Set | $O(n \log n + n \cdot s \cdot D)$ | $O(s \cdot D)$ | Sorts jobs descending by priority; uses path-compressed Union-Find (`find(slot)`) on a discrete timeline to find the latest available slot $\le$ deadline in $O(\alpha(D))$ time. |
| **0/1 Knapsack DP** | Dynamic Programming | $O(n \cdot C)$ | $O(n \cdot C)$ | True 2D DP matrix ($i \times w$) over CPU capacity and jobs. $DP[i][w] = \max(DP[i-1][w], DP[i-1][w - c_i] + p_i)$ with memory verification, followed by backtracking to reconstruct the optimal job subset. |
*Notation: $n$ = number of jobs, $s$ = number of server nodes, $D$ = maximum deadline horizon, $C$ = total CPU capacity.*

---

## 💡 Novel Idea: Data Center Power & Green Computing Model

To fulfill the course evaluation **"Novel Idea"** criterion, this application implements a live data center power consumption and carbon footprint model:
- **Baseline Idle Power:** $P_{\text{idle}} = 120\text{ W}$ for any active server node across its makespan horizon.
- **Dynamic Workload Power:** $P_{\text{dyn}} = 180\text{ W} \times \left(0.65 \frac{\text{job.cpu}}{\text{serverCpu}} + 0.35 \frac{\text{job.mem}}{\text{serverMemory}}\right)$ active during job execution.
- **Total Energy (kWh):** Integrates server active time and load:
  $$E_{\text{total}} = \sum_{\text{servers}} \left( P_{\text{idle}} \cdot T_{\text{active}} + \sum_{\text{jobs}} P_{\text{dyn}}(\text{job}) \cdot \text{duration} \right)$$
- **Green Efficiency Score:** $\text{Score} = \frac{\text{Total Priority Served}}{\max(E_{\text{total}}, 0.001)}$, measuring algorithmic priority delivered per kilowatt-hour.
- **Carbon Footprint (kg CO₂):** Computed based on average grid carbon intensity (0.42 kg CO₂/kWh).

---

## 🖥️ User Interface Walkthrough

1. **Configuration & Presets:**
   - Sliders and synchronized number inputs for job count ($n$), cluster CPU, cluster RAM, node count, and ranges.
   - 1-Click Presets: **Balanced (n=15)**, **DP Focus (n=12)**, and **Stress Benchmark (n=80)**.
   - Deterministic random seed ensures reproducible inputs across algorithm comparisons.
2. **Interactive Gantt Timeline:**
   - Multi-server visual timeline with tick ruler and real-time node busy percentages.
   - Color-coded job blocks by priority tier (Blue = Low, Purple = Medium, Pink = High, Amber = Active Decision).
   - Rich hover tooltips revealing arrival, duration, deadline, CPU, memory, and priority.
3. **Player & Scrubber:**
   - Play, Pause, Step Forward, Step Backward, Jump to Start/End.
   - Interactive scrub bar allowing users to jump directly to any step in the trace.
   - Speed multiplier slider ($1\times$ to $10\times$).
4. **Internal Algorithm Visualizers:**
   - **0/1 Knapsack:** Animated 2D DP matrix showing cell-by-cell filling, mathematical recurrence formula, taken cells in green, and the backtracking path in glowing amber.
5. **Comparison Engine:**
   - Executes all algorithms on the identical job pool with one click.
   - Side-by-side metric table highlighting the winning algorithm for each metric with a trophy 🏆.
   - Multi-metric comparative bar chart.
6. **Live Benchmark Suite:**
   - Measures server-side wall-clock execution time (using `process.hrtime.bigint()`) across $n = [10, 20, 50, 100, 200]$.
   - Plots measured performance curves alongside scaled theoretical asymptotic Big-O curves ($O(n)$, $O(n \log n)$, $O(n^2)$, $O(2^n)$).
7. **Editable Job Pool Table:**
   - Direct inline editing of individual job parameters in the table, persisting into subsequent runs.

---

## 🧪 Testing

Run the automated test script to verify all four algorithms:
```bash
node scripts/smoke.js
```
Expected output:
```
fcfs ok completed=10 trace=22
sjf ok completed=10 trace=22
deadlines ok completed=8 trace=22
knapsack ok completed=9 trace=202
```

---

## 📄 License
MIT License — Created for DAA Course Project Evaluation.
