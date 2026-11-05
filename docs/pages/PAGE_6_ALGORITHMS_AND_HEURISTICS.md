# Page 6: AI & Heuristic Algorithms Lab

## 1. Executive Overview

Machine learning models such as Multi-Layer Perceptrons (MLPs) excel at evaluating point-in-time, tabular transaction feature vectors. However, sophisticated financial syndicates exploit structural blind spots:
1. **Multi-Hop Layering**: Laundering funds through chains of mule accounts across different banks.
2. **Circular Wash Trading**: Routing transactions in closed loops ($A \to B \to C \to A$) to fabricate volume or disguise illicit capital origins.
3. **Structured Smurfing**: Breaking down large deposits into amounts just below statutory reporting limits (e.g., $\$9,200 - \$9,950$ to evade the $\$10,000$ AML threshold).
4. **Synthetic Fabrication**: Using automated fraud bots whose amounts violate natural statistical distributions (Benford's Law).
5. **Causal Explainability Deficits**: Regulators demanding strict causal justifications under partial evidence, which black-box neural networks struggle to provide.

The **AI & Heuristic Algorithms Lab** implements a comprehensive algorithmic suite combining **Graph Search**, **Forensic Statistical Heuristics**, **Stochastic Meta-Heuristics**, and **Probabilistic Causal AI** to solve these challenges.

---

## 2. Architecture & Subtab Navigation

The lab is organized into four modular subtabs:

```text
  ┌────────────────────────────────────────────────────────────────────────┐
  │                   Page 6: Algorithms & Heuristics Suite                │
  └───────┬───────────────────┬───────────────────┬──────────────────┬─────┘
          │                   │                   │                  │
          ▼                   ▼                   ▼                  ▼
    [ Subtab 1 ]        [ Subtab 2 ]        [ Subtab 3 ]       [ Subtab 4 ]
    Graph Search          Forensic            Simulated          Bayesian
   & Pathfinding         Heuristics           Annealing          Networks
   - BFS (Layering)     - Benford's Law      - Client Weight    - Causal DAG
   - DFS (Cycles)       - AML Smurfing         Optimization     - Variable
   - A* vs Dijkstra     - Chi-Square (χ²)    - Thermal Decay      Elimination
```

---

## 3. Subtab 1: Graph Traversal & Topology Search

### 3.1. Multi-Bank Directed Graph Topology
The page displays an interactive SVG topology visualizing cross-institutional fund flows between:
- **Bank A Nodes** (Blue): Originating card swipe accounts (e.g. `A_CARD_901`).
- **Bank B Nodes** (Emerald): Mobile money intermediary wallets (e.g. `B_MOBI_201`, `B_MOBI_202`, `B_MOBI_203`).
- **Bank C Nodes** (Amber): Retail payment points and return nodes (e.g. `C_RETL_301`, `C_RETL_303`).
- **Target Cashout Sink** (Rose): Liquidation terminal or ATM cashout endpoint (`C_RETL_302`).

### 3.2. Algorithm 1: Breadth-First Search (BFS) — Money Mule Layering
- **Concept**: Breadth-First Search traverses the multi-bank directed graph level-by-level up to a user-defined radius of $K$ hops (1 to 4 hops).
- **Time Complexity**: $\mathcal{O}(|V| + |E|)$
- **Financial Utility**: Discovers rapid dispersion of illicit funds from a compromised account into multiple secondary and tertiary mule accounts across institutions.
- **UI Controls**:
  - *Root Suspect Account Input* (Default: `A_CARD_901`).
  - *Max Depth Slider* (1 to 4 hops).
  - *Execute BFS Trace Button*.
- **Output**: Traversal sequence, visited node count, and detailed breakdown of flagged mule accounts with their exposure amount and predicted fraud probability.

### 3.3. Algorithm 2: Depth-First Search (DFS) — Circular Wash-Trading Cycles
- **Concept**: Employs an active recursion stack to detect back-edges forming closed directed cycles ($A \to B \to C \to A$) in $\mathcal{O}(|V| + |E|)$ time without visiting redundant permutations.
- **Financial Utility**: Identifies round-trip transactions engineered to create artificial liquidity, fabricate account histories, or disguise the provenance of illicit capital.
- **UI Controls**:
  - *Detect Cycles (DFS) Button*.
- **Output**: List of identified cycle paths, involved banks, loop lengths, and severity ratings.

### 3.4. Algorithm 3: A* Informed Heuristic Search vs. Dijkstra
- **Concept**: Finds the optimal high-risk liquidation escape route between a suspect origin account and a target cashout sink.
- **Evaluation Function**:
  $$f(n) = g(n) + h(n)$$
  - $g(n)$: Cumulative transaction fees / latency along the path.
  - $h(n)$: Admissible heuristic estimating remaining distance to the cashout sink based on institutional transfer scale and counterparty risk profile.
- **Empirical Comparison**:
  - **Dijkstra (Uninformed)**: Expands nodes radially in all directions.
  - **A* (Informed)**: Directs search toward the target sink, reducing node expansions by $40\% - 65\%$.
- **UI Controls**:
  - *Origin Input* (e.g. `A_CARD_901`) and *Target Input* (e.g. `C_RETL_302`).
  - *Compare A* vs Dijkstra Button*.
- **Output**: Side-by-side node expansion counts, discovered optimal paths, and calculated heuristic efficiency gains.

---

## 4. Subtab 2: Forensic Heuristics

### 4.1. Heuristic 1: Benford's Law Chi-Square ($\chi^2$) First-Digit Analyzer
- **Mathematical Law**: In natural financial accounting datasets, the leading digit $d \in \{1, 2, \dots, 9\}$ occurs with the exact logarithmic probability:
  $$P(d) = \log_{10}\left(1 + \frac{1}{d}\right)$$
  - Digit 1 appears $\approx 30.1\%$ of the time.
  - Digit 9 appears only $\approx 4.6\%$ of the time.
- **Test Statistic**: Goodness-of-fit evaluated via Pearson's Chi-Square:
  $$\chi^2 = \sum_{d=1}^{9} \frac{\left(O_d - E_d\right)^2}{E_d}$$
  where $O_d$ is the observed digit frequency and $E_d$ is the Benford expected count. Critical cutoff at $p = 0.01$ with 8 degrees of freedom is $\chi_{\text{crit}}^2 = 20.09$.
- **Financial Utility**: Automated bot scripts and human fraudsters fabricating synthetic invoices or stolen card amounts invent amounts with unnatural digit frequencies that fail the $\chi^2$ test.
- **UI Controls**:
  - *Test Natural Transactions Button* (Demonstrates compliance with Benford's Law).
  - *Inject Fabricated Sample Button* (Demonstrates immediate detection of synthetic amounts).
- **Visualization**: Interactive 9-digit distribution chart showing observed vs. expected frequencies.

### 4.2. Heuristic 2: AML Smurfing & Structuring Detector
- **Regulatory Rule**: Under the Bank Secrecy Act (BSA), cash transfers $\ge \$10,000$ mandate Currency Transaction Reports (CTRs).
- **Adversarial Behavior**: Criminals structure payments into bands just below the limit (e.g. $\$9,200$ to $\$9,950$).
- **Heuristic Engine**: Audits transaction clusters across a rolling 48-hour window, flagging sender-receiver pairs exhibiting repetitive sub-threshold amounts.
- **UI Controls**:
  - *Audit Smurfed Batch ($9k+) Button*.
  - *Audit Benign Transfers Button*.
- **Output**: Structuring violation flags, monitored boundary bands, heuristic actions, and lists of flagged transactions with sender and receiver identities.

---

## 5. Subtab 3: Meta-Heuristics (Simulated Annealing)

### 5.1. Problem Formulation
Standard FedAvg assigns client weights based solely on local sample counts ($w_k = n_k / N$). However, banks exhibit heterogeneous communication latencies, varying class imbalances, and differing gradient noise levels.

### 5.2. Annealing Energy & Optimization Engine
Simulated Annealing searches the continuous simplex $\sum_{k} w_k = 1$ to maximize validation PR-AUC while penalizing latency and Frobenius norm divergence:

$$\text{Fitness}(w) = \text{PR-AUC}(w) - \lambda_1 \cdot \text{Latency}(w) - \lambda_2 \cdot \|\Delta W(w)\|_F$$

- **Initial Temperature**: $T_0 = 100.0$
- **Cooling Rate**: Geometric decay $T_{t+1} = \alpha \cdot T_t$ with $\alpha = 0.92$
- **Metropolis Acceptance Criterion**:
  $$P(\text{accept}) = \begin{cases} 1.0 & \text{if } \Delta \text{Fitness} > 0 \\ \exp\left(\frac{\Delta \text{Fitness}}{T}\right) & \text{if } \Delta \text{Fitness} \le 0 \end{cases}$$
- **UI Controls**:
  - *Run Simulated Annealing Button*.
- **Output**: Converged optimal client weight distribution across Bank A, Bank B, and Bank C, along with a full cooling trajectory history table.

---

## 6. Subtab 4: Probabilistic AI (Bayesian Belief Network)

### 6.1. Causal Directed Acyclic Graph (DAG)
Black-box neural networks provide point scores without causal reasoning. The Bayesian Belief Network models the joint probability distribution over 5 interdependent financial risk variables:

```text
       [ TimeRisk ]             [ ForeignIP ]
       (Odd Hours)               (Geo-Anomaly)
            │                         │
            ├────────────┬────────────┤
            ▼            ▼            ▼
     [ AmountSpike ]   [ Fraud ]   [ SuspiciousDevice ]
            │            ▲            │
            └────────────┴────────────┘
```

### 6.2. Exact Inference via Variable Elimination
Given observed evidence $\mathbf{e} = \{e_1, e_2, \dots, e_m\}$, the network computes the exact posterior probability of fraud:

$$P(\text{Fraud} = \text{YES} \mid \mathbf{e}) = \frac{\sum_{\mathbf{y} \notin \mathbf{e} \cup \{\text{Fraud}\}} P(\text{Fraud} = \text{YES}, \mathbf{y}, \mathbf{e})}{\sum_{\text{Fraud}} \sum_{\mathbf{y} \notin \mathbf{e} \cup \{\text{Fraud}\}} P(\text{Fraud}, \mathbf{y}, \mathbf{e})}$$

### 6.3. Interactive Evidence Toggling & Explainability
- Users can click any evidence state to dynamically toggle its observation:
  - *TimeRisk*: `NORMAL` vs. `ODD_HOURS`
  - *ForeignIP*: `DOMESTIC` vs. `ANOMALOUS_GEO`
  - *AmountSpike*: `TYPICAL` vs. `SPIKE`
  - *BalanceEmptied*: `NO` vs. `YES`
  - *SuspiciousDevice*: `TRUSTED` vs. `UNRECOGNIZED`
- **Real-Time Posterior Shift**: The UI displays the base prior probability ($1.8\%$) alongside the updated posterior probability (e.g. $94.6\%$ under multiple adverse indicators), giving auditors mathematical causal explanations.

---

## 7. Backend REST Contracts

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/graph/topology` | Fetches nodes, edges, and amounts for the cross-bank graph. |
| `POST` | `/api/graph/bfs` | Executes Breadth-First Search money mule trace. |
| `POST` | `/api/graph/dfs` | Executes Depth-First Search circular cycle detection. |
| `POST` | `/api/graph/astar` | Compares $A^*$ heuristic search against Dijkstra. |
| `POST` | `/api/heuristics/benford` | Runs Chi-Square Benford's Law test on natural or synthetic data. |
| `POST` | `/api/heuristics/smurfing` | Runs AML structuring detection on transaction batches. |
| `POST` | `/api/heuristics/simulated-annealing` | Executes client weight optimization over cooling trajectory. |
| `POST` | `/api/algorithms/bayesian` | Computes exact conditional probability via variable elimination. |

---

## 8. Summary of Capabilities

By combining neural representation learning with graph search, statistical forensics, meta-heuristics, and Bayesian causality, Page 6 provides an institutional-grade security and explainability suite that meets the most rigorous regulatory standards in global banking.
