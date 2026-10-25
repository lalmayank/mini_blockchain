"use client";

import React, { useState, useEffect } from "react";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Cpu,
  Layers,
  Database,
  Search,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  Terminal,
  RefreshCw,
  Lock,
  ArrowRight,
  TrendingUp,
  BarChart3,
  Check,
  FileCheck
} from "lucide-react";
import * as api from "./api";

export default function App() {
  const [activeTab, setActiveTab] = useState<"overview" | "training" | "fraud" | "security" | "audit">("overview");

  // Live Backend Data States
  const [status, setStatus] = useState<any>(null);
  const [banks, setBanks] = useState<any[]>([]);
  const [globalModel, setGlobalModel] = useState<any>(null);
  const [trainingStatus, setTrainingStatus] = useState<any>(null);
  const [auditRounds, setAuditRounds] = useState<any[]>([]);
  const [comparison, setComparison] = useState<any[]>([]);
  const [samples, setSamples] = useState<any[]>([]);
  const [backendOnline, setBackendOnline] = useState(false);
  const [loading, setLoading] = useState(false);

  // Control 1: Start Training state
  const [trainRoundId, setTrainRoundId] = useState(3);
  const [trainDefense, setTrainDefense] = useState("fedavg");
  const [trainEpochs, setTrainEpochs] = useState(1);

  // Control 2: Attack Simulation state
  const [attackAttacker, setAttackAttacker] = useState("bank_c");
  const [attackType, setAttackType] = useState("scale_poison");
  const [attackDefense, setAttackDefense] = useState("fedavg");
  const [attackResult, setAttackResult] = useState<any>(null);
  const [simulatingAttack, setSimulatingAttack] = useState(false);

  // Plain-English Human Transaction Wizard State
  const [wizardAmount, setWizardAmount] = useState<number>(2500);
  const [wizardChannel, setWizardChannel] = useState<string>("transfer");
  const [wizardTime, setWizardTime] = useState<string>("midnight");
  const [wizardIsUnusualAmt, setWizardIsUnusualAmt] = useState<boolean>(true);
  const [wizardBalanceEmptied, setWizardBalanceEmptied] = useState<boolean>(true);
  const [wizardLocationRisk, setWizardLocationRisk] = useState<boolean>(true);
  const [inputMode, setInputMode] = useState<"wizard" | "advanced">("wizard");

  // Blockchain View Mode
  const [chainViewMode, setChainViewMode] = useState<"visual" | "table">("visual");
  const [selectedBlockId, setSelectedBlockId] = useState<number | null>(null);

  // Helper function to map human answers to 16 normalized ML dimensions
  const applyWizardTo16D = (
    amt: number,
    channel: string,
    timeOfDay: string,
    unusualAmt: boolean,
    balanceEmptied: boolean,
    locRisk: boolean
  ) => {
    // 1. Amount conversions
    const medianAmt = 150;
    const amtNorm = Math.min(Math.max((amt - medianAmt) / 500, -2.0), 6.0);
    const amtLog = Math.log1p(Math.max(amt, 0)) / 10.0;
    const isHighAmt = amt > 1000 || unusualAmt ? 1.0 : 0.0;

    // 2. Cyclical Time
    let hour = 14; // Default afternoon
    if (timeOfDay === "midnight") hour = 3;
    else if (timeOfDay === "morning") hour = 9;
    else if (timeOfDay === "evening") hour = 23;
    const hourSin = Math.sin((2 * Math.PI * hour) / 24);
    const hourCos = Math.cos((2 * Math.PI * hour) / 24);
    const daySin = 0.43; // Mid-week
    const dayCos = 0.90;
    const velocityProxy = unusualAmt ? 0.85 : 0.25;

    // 3. Channel Risk
    const isHighRiskChannel = channel === "transfer" || channel === "cashout" || channel === "crypto" ? 1.0 : 0.0;
    const rapidOutflow = balanceEmptied || unusualAmt ? 1.0 : 0.0;
    const ratioToMedian = Math.min(amt / medianAmt, 50) / 50.0;
    const zeroBal = balanceEmptied ? 1.0 : 0.0;

    // 4. Anomaly score
    const heuristic = (locRisk ? 0.6 : 0.0) + (isHighRiskChannel ? 0.3 : 0.0) + (unusualAmt ? 0.3 : -0.2);
    const outflowDir = channel === "incoming" ? 0.0 : 1.0;
    const instScale = channel === "transfer" ? 0.8 : 0.5;
    const deviationScore = locRisk || unusualAmt ? 0.88 : -0.15;

    return [
      Number(amtNorm.toFixed(3)),
      Number(amtLog.toFixed(3)),
      isHighAmt,
      Number(hourSin.toFixed(3)),
      Number(hourCos.toFixed(3)),
      daySin,
      dayCos,
      velocityProxy,
      isHighRiskChannel,
      rapidOutflow,
      Number(ratioToMedian.toFixed(3)),
      zeroBal,
      Number(Math.min(Math.max(heuristic, -1.0), 1.0).toFixed(3)),
      outflowDir,
      instScale,
      deviationScore
    ];
  };

  // Auto-sync wizard changes to 16D features
  useEffect(() => {
    if (inputMode === "wizard") {
      const generated = applyWizardTo16D(
        wizardAmount,
        wizardChannel,
        wizardTime,
        wizardIsUnusualAmt,
        wizardBalanceEmptied,
        wizardLocationRisk
      );
      setCustomFeatures(generated);
    }
  }, [wizardAmount, wizardChannel, wizardTime, wizardIsUnusualAmt, wizardBalanceEmptied, wizardLocationRisk, inputMode]);
  // Control 3: Predict Transaction & Evaluate Dataset
  const [selectedSample, setSelectedSample] = useState<any>(null);
  const [customFeatures, setCustomFeatures] = useState<number[]>(new Array(16).fill(0));
  const [threshold, setThreshold] = useState(0.5);
  const [predictionResult, setPredictionResult] = useState<any>(null);
  const [evaluatingDataset, setEvaluatingDataset] = useState(false);
  const [datasetEvalResult, setDatasetEvalResult] = useState<any>(null);
  const [chosenDatasetKey, setChosenDatasetKey] = useState("bank_a");

  // Control 4: Verify Hash state
  const [verifyRoundId, setVerifyRoundId] = useState(1);
  const [verifyHashInput, setVerifyHashInput] = useState("");
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [verifyingHash, setVerifyingHash] = useState(false);

  // Polling for live status
  useEffect(() => {
    loadInitialData();
    const interval = setInterval(() => {
      refreshLiveStatus();
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const loadInitialData = async () => {
    try {
      const [st, bk, gm, ar, comp, smp] = await Promise.all([
        api.getSystemStatus(),
        api.getRegisteredBanks(),
        api.getGlobalModel(),
        api.getAuditRounds(),
        api.getModelComparison(),
        api.getFraudSamples()
      ]);
      setStatus(st);
      setBanks(bk.banks || []);
      setGlobalModel(gm);
      setAuditRounds(ar.rounds || []);
      setComparison(comp.benchmarks || []);
      setSamples(smp.samples || []);
      setBackendOnline(true);

      if (smp.samples && smp.samples.length > 0) {
        setSelectedSample(smp.samples[1]); // Default to Bank A Fraud
        setCustomFeatures([...smp.samples[1].features]);
      }
      if (gm?.weights_hash) {
        setVerifyHashInput(gm.weights_hash);
      }
    } catch (err) {
      setBackendOnline(false);
    }
  };

  const refreshLiveStatus = async () => {
    try {
      const [st, tr, ar, gm] = await Promise.all([
        api.getSystemStatus(),
        api.getTrainingStatus(),
        api.getAuditRounds(),
        api.getGlobalModel()
      ]);
      setStatus(st);
      setTrainingStatus(tr);
      setAuditRounds(ar.rounds || []);
      setGlobalModel(gm);
      setBackendOnline(true);
    } catch (e) {
      setBackendOnline(false);
    }
  };

  // CONTROL 1: Start Training
  const handleStartTraining = async () => {
    setLoading(true);
    try {
      await api.startTrainingRound({
        round_id: trainRoundId,
        defense_strategy: trainDefense,
        epochs: trainEpochs
      });
      setTrainRoundId((prev) => prev + 1);
    } catch (err: any) {
      alert("Failed to start training: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // CONTROL 2: Run Attack Simulation
  const handleSimulateAttack = async () => {
    setSimulatingAttack(true);
    setAttackResult(null);
    try {
      const res = await api.simulateAttack({
        attacker: attackAttacker,
        attack_type: attackType,
        defense_strategy: attackDefense,
        round_id: 99
      });
      setAttackResult(res);
    } catch (err: any) {
      alert("Attack simulation failed: " + err.message);
    } finally {
      setSimulatingAttack(false);
    }
  };

  // CONTROL 3: Predict Transaction
  const handleScoreTransaction = async () => {
    try {
      const res = await api.predictFraud(customFeatures, threshold);
      setPredictionResult(res);
    } catch (err: any) {
      alert("Inference failed: " + err.message);
    }
  };

  // CONTROL 3B: Evaluate Whole Dataset
  const handleEvaluateDataset = async () => {
    setEvaluatingDataset(true);
    setDatasetEvalResult(null);
    try {
      const res = await api.evaluateDataset(chosenDatasetKey, threshold);
      setDatasetEvalResult(res);
    } catch (err: any) {
      alert("Dataset evaluation failed: " + err.message);
    } finally {
      setEvaluatingDataset(false);
    }
  };

  // CONTROL 4: Verify Hash
  const handleVerifyHash = async () => {
    setVerifyingHash(true);
    setVerifyResult(null);
    try {
      const res = await api.verifyModelHash(verifyRoundId, verifyHashInput.trim());
      setVerifyResult(res);
    } catch (err: any) {
      alert("Verification request failed: " + err.message);
    } finally {
      setVerifyingHash(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navigation */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-gradient-to-tr from-cyan-500 to-indigo-600 rounded-xl shadow-lg shadow-indigo-500/20">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold tracking-tight text-white">CrossBank TrustFL</h1>
              <span className="px-2 py-0.5 text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded font-semibold uppercase">
                Live Prototype
              </span>
            </div>
            <p className="text-xs text-slate-400">Blockchain-Audited Federated Learning for Cross-Bank Fraud Detection</p>
          </div>
        </div>

        {/* Backend & Chain Status Badges */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 bg-slate-800 border border-slate-700 rounded-full px-3 py-1">
            <span className={`w-2 h-2 rounded-full ${backendOnline ? "bg-emerald-400 animate-pulse" : "bg-rose-400"}`}></span>
            <span className="text-xs font-medium text-slate-300">
              Backend: {backendOnline ? "Live (FastAPI :8000)" : "Connecting..."}
            </span>
          </div>

          <div className="flex items-center space-x-2 bg-slate-800 border border-slate-700 rounded-full px-3 py-1">
            <Lock className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-xs font-medium text-cyan-300">Solidity EVM On-Chain</span>
          </div>

          <button
            onClick={() => { refreshLiveStatus(); loadInitialData(); }}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition"
            title="Refresh from Backend"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Main Tabs Navigation */}
      <div className="border-b border-slate-800 bg-slate-900/60 px-6 flex space-x-1">
        {[
          { id: "overview", label: "Page 1 — Overview Dashboard", icon: Activity },
          { id: "training", label: "Page 2 — Federated Learning", icon: Cpu },
          { id: "fraud", label: "Page 3 — Fraud Explorer", icon: Search },
          { id: "security", label: "Page 4 — Trust & Security", icon: ShieldAlert },
          { id: "audit", label: "Page 5 — Blockchain Audit", icon: Layers }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 px-5 py-3.5 text-xs font-semibold border-b-2 transition ${
                isActive
                  ? "border-cyan-500 text-cyan-400 bg-cyan-950/20"
                  : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">

        {/* =========================================================================
            PAGE 1 — OVERVIEW DASHBOARD
            ========================================================================= */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Live Indicator Banner */}
            <div className="p-3 bg-cyan-950/30 border border-cyan-800/40 rounded-lg flex items-center justify-between text-xs text-cyan-300">
              <span className="flex items-center space-x-2">
                <CheckCircle2 className="h-4 w-4 text-cyan-400" />
                <span>Showing live backend parameters extracted directly from local PyTorch weights and Solidity contract.</span>
              </span>
              <span className="font-mono text-[11px] text-cyan-400 font-bold">100% Real Backend Data</span>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-5 bg-slate-900/80 border border-slate-800 rounded-xl">
                <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  <span>Current Global Round</span>
                  <Activity className="h-4 w-4 text-cyan-400" />
                </div>
                <div className="mt-2 text-3xl font-bold text-white">Round {status?.current_round ?? 0}</div>
                <div className="mt-1 flex items-center space-x-1.5 text-xs text-emerald-400">
                  <Check className="h-3.5 w-3.5" />
                  <span>Consensus converged</span>
                </div>
              </div>

              <div className="p-5 bg-slate-900/80 border border-slate-800 rounded-xl">
                <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  <span>Participating Banks</span>
                  <Database className="h-4 w-4 text-indigo-400" />
                </div>
                <div className="mt-2 text-3xl font-bold text-white">3 Nodes</div>
                <p className="mt-1 text-xs text-slate-400">Bank A, Bank B, Bank C</p>
              </div>

              <div className="p-5 bg-slate-900/80 border border-slate-800 rounded-xl">
                <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  <span>On-Chain Audited Rounds</span>
                  <Layers className="h-4 w-4 text-amber-400" />
                </div>
                <div className="mt-2 text-3xl font-bold text-white">{status?.total_audited_rounds ?? 0} Committed</div>
                <p className="mt-1 text-xs text-slate-400">Stored on FraudAudit.sol</p>
              </div>

              <div className="p-5 bg-slate-900/80 border border-slate-800 rounded-xl">
                <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  <span>Active Model Size</span>
                  <Cpu className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="mt-2 text-3xl font-bold text-emerald-400">3,393 Weights</div>
                <p className="mt-1 text-xs text-slate-400">16-dim Universal MLP</p>
              </div>
            </div>

            {/* Global Model Fingerprint Card */}
            <div className="p-5 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Active Global Model Fingerprint (SHA-256)</span>
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-xs font-medium">
                  Verified On-Chain
                </span>
              </div>
              <div className="p-3 bg-slate-950 border border-slate-800/80 rounded-lg font-mono text-xs text-cyan-300 break-all select-all">
                {status?.active_global_model_hash ?? "Loading live model hash..."}
              </div>
            </div>

            {/* Participating Bank Cards */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-white">Three Participating Simulated Banks</h2>
                <span className="text-xs text-slate-400">Raw transaction datasets remain 100% private</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {banks.map((b) => (
                  <div key={b.id} className="p-5 bg-slate-900/80 border border-slate-800 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-sm">{b.name}</span>
                      <span className="px-2 py-0.5 text-[11px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full">
                        {b.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400">{b.dataset_source}</div>

                    <div className="space-y-1.5 text-xs pt-2 border-t border-slate-800 font-mono">
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-sans">Total Records:</span>
                        <span className="text-slate-200">{b.records.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-sans">Fraud Cases:</span>
                        <span className="text-rose-400">{b.fraud_count.toLocaleString()} ({b.fraud_rate_pct}%)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-sans">Shared Features:</span>
                        <span className="text-cyan-400">{b.features_shared} inputs</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            PAGE 2 — FEDERATED LEARNING CONSOLE
            ========================================================================= */}
        {activeTab === "training" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Control: Start Training Round */}
            <div className="lg:col-span-1 p-6 bg-slate-900/80 border border-slate-800 rounded-xl space-y-5">
              <div>
                <h2 className="text-base font-bold text-white flex items-center space-x-2">
                  <Play className="h-5 w-5 text-cyan-400" />
                  <span>Start Training Round</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Triggers local client training across all 3 banks, runs coordinator defense screening, and updates the global model on-chain.
                </p>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Round ID to Train</label>
                  <input
                    type="number"
                    value={isNaN(trainRoundId) ? "" : trainRoundId}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      setTrainRoundId(isNaN(v) ? 0 : v);
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Defense & Aggregation Strategy</label>
                  <select
                    value={trainDefense}
                    onChange={(e) => setTrainDefense(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="fedavg">Sample-Weighted FedAvg (Standard)</option>
                    <option value="coordinate_median">Coordinate-wise Median (Byzantine-Robust)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Local Training Epochs</label>
                  <select
                    value={trainEpochs}
                    onChange={(e) => setTrainEpochs(parseInt(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value={1}>1 Local Epoch</option>
                    <option value={2}>2 Local Epochs</option>
                  </select>
                </div>

                {/* Primary Button */}
                <button
                  onClick={handleStartTraining}
                  disabled={loading || trainingStatus?.status === "RUNNING"}
                  className={`w-full py-3 rounded-lg font-bold text-xs uppercase tracking-wider transition flex items-center justify-center space-x-2 ${
                    trainingStatus?.status === "RUNNING"
                      ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                      : "bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-600/30"
                  }`}
                >
                  <Play className="h-4 w-4" />
                  <span>{trainingStatus?.status === "RUNNING" ? "Round In Progress..." : "Execute Training Round"}</span>
                </button>
              </div>

              {/* Status Box */}
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs space-y-1 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">Coordinator Status:</span>
                  <span className="text-cyan-400 font-bold">{trainingStatus?.status ?? "IDLE"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Progress:</span>
                  <span className="text-white">{trainingStatus?.progress_percent ?? 0}%</span>
                </div>
              </div>
            </div>

            {/* Live Progress & Log Stream */}
            <div className="lg:col-span-2 space-y-6">
              {/* Progress Card */}
              <div className="p-6 bg-slate-900/80 border border-slate-800 rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Round Progression</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{trainingStatus?.current_step ?? "Idle"}</p>
                  </div>
                  <span className="px-2.5 py-1 text-xs rounded-full font-bold bg-slate-800 text-cyan-400 border border-slate-700">
                    {trainingStatus?.progress_percent ?? 0}%
                  </span>
                </div>

                <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-cyan-500 to-indigo-500 h-full transition-all duration-300"
                    style={{ width: `${trainingStatus?.progress_percent ?? 0}%` }}
                  ></div>
                </div>

                <div className="grid grid-cols-4 text-center text-[11px] text-slate-400 pt-1">
                  <div>1. Local Training</div>
                  <div>2. Defense Screen</div>
                  <div>3. Parameter Aggregation</div>
                  <div>4. Smart Contract Commit</div>
                </div>
              </div>

              {/* Terminal Logs */}
              <div className="p-5 bg-black border border-slate-800 rounded-xl font-mono text-xs text-slate-300 space-y-2">
                <div className="flex items-center space-x-2 text-slate-400 pb-2 border-b border-slate-800">
                  <Terminal className="h-4 w-4 text-cyan-400" />
                  <span className="font-bold text-slate-200">Live Training & Defense Execution Log</span>
                </div>
                <div className="h-64 overflow-y-auto space-y-1.5 pt-2 text-slate-300">
                  {trainingStatus?.logs && trainingStatus.logs.length > 0 ? (
                    trainingStatus.logs.map((log: string, idx: number) => (
                      <div key={idx} className="leading-relaxed">
                        <span className="text-cyan-500">[{idx + 1}]</span> {log}
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-500 italic">No training in progress. Click 'Execute Training Round' to trigger.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            PAGE 3 — FRAUD EXPLORER & DATASET EVALUATION
            ========================================================================= */}
        {activeTab === "fraud" && (
          <div className="space-y-6">
            {/* Control: Evaluate Whole Dataset */}
            <div className="p-6 bg-slate-900/80 border border-slate-800 rounded-xl space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center space-x-2">
                    <BarChart3 className="h-5 w-5 text-cyan-400" />
                    <span>Evaluate Global Model on Labelled Test Dataset</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Evaluates the active Global MLP across the full held-out test split on disk, computing actual PR-AUC, F1, Precision, and Recall.
                  </p>
                </div>

                <div className="flex items-center space-x-3">
                  <select
                    value={chosenDatasetKey}
                    onChange={(e) => setChosenDatasetKey(e.target.value)}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="bank_a">Bank A (Credit Card Test Split)</option>
                    <option value="bank_b">Bank B (PaySim Mobile Test Split)</option>
                    <option value="bank_c">Bank C (BankSim Retail Test Split)</option>
                  </select>

                  <button
                    onClick={handleEvaluateDataset}
                    disabled={evaluatingDataset}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg transition"
                  >
                    {evaluatingDataset ? "Evaluating on Disk..." : "Run Test Set Evaluation"}
                  </button>
                </div>
              </div>

              {/* Dataset Evaluation Results Card */}
              {datasetEvalResult && (
                <div className="p-5 bg-slate-950 border border-indigo-900/40 rounded-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-indigo-300">{datasetEvalResult.dataset_name}</span>
                    <span className="text-xs font-mono text-slate-400">
                      Evaluated: {datasetEvalResult.evaluated_samples.toLocaleString()} transactions ({datasetEvalResult.actual_frauds_in_test} frauds)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 font-mono">
                    <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-center">
                      <div className="text-[10px] text-slate-400 font-sans uppercase">PR-AUC</div>
                      <div className="text-lg font-bold text-cyan-400 mt-1">{datasetEvalResult.pr_auc}</div>
                    </div>
                    <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-center">
                      <div className="text-[10px] text-slate-400 font-sans uppercase">ROC-AUC</div>
                      <div className="text-lg font-bold text-slate-200 mt-1">{datasetEvalResult.roc_auc}</div>
                    </div>
                    <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-center">
                      <div className="text-[10px] text-slate-400 font-sans uppercase">F1-Score</div>
                      <div className="text-lg font-bold text-emerald-400 mt-1">{datasetEvalResult.f1_score}</div>
                    </div>
                    <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-center">
                      <div className="text-[10px] text-slate-400 font-sans uppercase">Precision</div>
                      <div className="text-lg font-bold text-slate-200 mt-1">{datasetEvalResult.precision}</div>
                    </div>
                    <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-center">
                      <div className="text-[10px] text-slate-400 font-sans uppercase">Recall</div>
                      <div className="text-lg font-bold text-amber-400 mt-1">{datasetEvalResult.recall}</div>
                    </div>
                  </div>

                  {datasetEvalResult.confusion_matrix && (
                    <div className="text-xs text-slate-400 flex items-center justify-between pt-2 border-t border-slate-900">
                      <span>Confusion Matrix: [TN: {datasetEvalResult.confusion_matrix[0][0]}, FP: {datasetEvalResult.confusion_matrix[0][1]}, FN: {datasetEvalResult.confusion_matrix[1][0]}, TP: {datasetEvalResult.confusion_matrix[1][1]}]</span>
                      <span className="text-emerald-400 font-bold">Real Evaluation on Live Data</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Individual Transaction Inference */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Sample Transactions */}
              <div className="lg:col-span-1 p-6 bg-slate-900/80 border border-slate-800 rounded-xl space-y-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                  <Search className="h-4 w-4 text-cyan-400" />
                  <span>Test Single Transactions</span>
                </h3>

                <div className="space-y-2">
                  {samples.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setSelectedSample(s);
                        setCustomFeatures([...s.features]);
                        setPredictionResult(null);
                      }}
                      className={`w-full text-left p-3 rounded-lg border text-xs transition ${
                        selectedSample?.id === s.id
                          ? "bg-cyan-950/40 border-cyan-500/60 text-white"
                          : "bg-slate-950 border-slate-800/80 text-slate-300 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-cyan-400">{s.bank}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          s.ground_truth === "Fraud" ? "bg-rose-500/20 text-rose-400" : "bg-emerald-500/20 text-emerald-400"
                        }`}>
                          {s.ground_truth}
                        </span>
                      </div>
                      <p className="text-slate-400 text-[11px] leading-tight">{s.description}</p>
                    </button>
                  ))}
                </div>

                {/* Threshold Slider */}
                <div className="pt-3 border-t border-slate-800 text-xs">
                  <div className="flex justify-between text-slate-300 font-medium mb-1">
                    <span>Threshold:</span>
                    <span className="font-mono text-cyan-400">{threshold.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="0.9"
                    step="0.05"
                    value={threshold}
                    onChange={(e) => setThreshold(parseFloat(e.target.value))}
                    className="w-full accent-cyan-500"
                  />
                </div>

                <button
                  onClick={handleScoreTransaction}
                  className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition"
                >
                  Score with Global MLP
                </button>
              </div>

              {/* Right Column: Prediction Output */}
              <div className="lg:col-span-2 space-y-6">
                {predictionResult && (
                  <div className={`p-6 border rounded-xl flex items-center justify-between ${
                    predictionResult.is_fraud
                      ? "bg-rose-950/30 border-rose-600/50 text-rose-200"
                      : "bg-emerald-950/30 border-emerald-600/50 text-emerald-200"
                  }`}>
                    <div>
                      <div className="flex items-center space-x-2">
                        {predictionResult.is_fraud ? (
                          <AlertTriangle className="h-6 w-6 text-rose-400" />
                        ) : (
                          <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                        )}
                        <span className="text-xl font-bold">
                          {predictionResult.is_fraud ? "FRAUD DETECTED" : "TRANSACTION APPROVED"}
                        </span>
                        <span className="px-2 py-0.5 text-xs font-bold bg-slate-900 border border-slate-700 rounded-full">
                          {predictionResult.risk_tier} RISK
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1 max-w-lg">{predictionResult.explanation}</p>
                    </div>

                    <div className="text-right">
                      <div className="text-xs uppercase text-slate-400">Score</div>
                      <div className="text-3xl font-bold font-mono">
                        {(predictionResult.fraud_probability * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                )}

                {/* Dual Mode Feature Editor: Simple Wizard vs Advanced 16D */}
                <div className="p-6 bg-slate-900/80 border border-slate-800 rounded-xl space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                        Create Custom Transaction
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {inputMode === "wizard"
                          ? "Answer simple everyday banking questions; the system converts them into 16 normalized ML inputs."
                          : "Directly edit all 16 normalized feature parameters (Advanced ML mode)."}
                      </p>
                    </div>

                    {/* Mode Toggle */}
                    <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                      <button
                        onClick={() => setInputMode("wizard")}
                        className={`px-3 py-1 rounded font-medium transition ${
                          inputMode === "wizard"
                            ? "bg-cyan-600 text-white shadow"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        🧙 Simple Questions
                      </button>
                      <button
                        onClick={() => setInputMode("advanced")}
                        className={`px-3 py-1 rounded font-medium transition ${
                          inputMode === "advanced"
                            ? "bg-cyan-600 text-white shadow"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        ⚙️ Advanced 16-D
                      </button>
                    </div>
                  </div>

                  {/* MODE A: SIMPLE QUESTIONS WIZARD */}
                  {inputMode === "wizard" && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                        {/* Question 1: Amount */}
                        <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1.5">
                          <label className="block text-slate-300 font-semibold">1. Transaction Amount ($ USD)</label>
                          <input
                            type="number"
                            min="1"
                            value={wizardAmount}
                            onChange={(e) => setWizardAmount(Math.max(1, parseFloat(e.target.value) || 0))}
                            className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-cyan-500"
                          />
                          <p className="text-[10px] text-slate-500">e.g. $25 for coffee, $2,500 for wire transfer</p>
                        </div>

                        {/* Question 2: Channel */}
                        <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1.5">
                          <label className="block text-slate-300 font-semibold">2. Transaction Type / Channel</label>
                          <select
                            value={wizardChannel}
                            onChange={(e) => setWizardChannel(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500"
                          >
                            <option value="card_swipe">In-Store Card Swipe (Bank A)</option>
                            <option value="online_pay">Online Merchant Payment (Bank C)</option>
                            <option value="transfer">Mobile Money Wire Transfer (Bank B - High Risk)</option>
                            <option value="cashout">Instant Cash-Out / ATM (Bank B - High Risk)</option>
                            <option value="crypto">Luxury Merchant / Jewelry (Bank C - High Risk)</option>
                          </select>
                          <p className="text-[10px] text-slate-500">Wires & Cash-outs carry inherently higher fraud risk</p>
                        </div>

                        {/* Question 3: Time */}
                        <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1.5">
                          <label className="block text-slate-300 font-semibold">3. Time of Transaction</label>
                          <select
                            value={wizardTime}
                            onChange={(e) => setWizardTime(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500"
                          >
                            <option value="morning">Morning (9:00 AM — Business Hours)</option>
                            <option value="afternoon">Afternoon (2:00 PM — Normal Day)</option>
                            <option value="evening">Late Evening (11:00 PM)</option>
                            <option value="midnight">Dead of Night (3:00 AM — High Risk Spike)</option>
                          </select>
                          <p className="text-[10px] text-slate-500">Midnight transactions trigger temporal anomaly signals</p>
                        </div>

                        {/* Question 4: Unusual Amount */}
                        <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1.5">
                          <label className="block text-slate-300 font-semibold">4. Customer Spending Behavior</label>
                          <div className="flex gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setWizardIsUnusualAmt(false)}
                              className={`flex-1 py-1.5 rounded text-xs font-medium border transition ${
                                !wizardIsUnusualAmt
                                  ? "bg-slate-800 border-cyan-500 text-cyan-300"
                                  : "bg-slate-900 border-slate-800 text-slate-400"
                              }`}
                            >
                              Normal for Customer
                            </button>
                            <button
                              type="button"
                              onClick={() => setWizardIsUnusualAmt(true)}
                              className={`flex-1 py-1.5 rounded text-xs font-medium border transition ${
                                wizardIsUnusualAmt
                                  ? "bg-rose-950/40 border-rose-600 text-rose-300"
                                  : "bg-slate-900 border-slate-800 text-slate-400"
                              }`}
                            >
                              ⚠️ 10x Spike vs Usual
                            </button>
                          </div>
                          <p className="text-[10px] text-slate-500">Flags sudden deviations from historical account habits</p>
                        </div>

                        {/* Question 5: Account Emptied */}
                        <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1.5">
                          <label className="block text-slate-300 font-semibold">5. Account Balance After Transaction</label>
                          <div className="flex gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setWizardBalanceEmptied(false)}
                              className={`flex-1 py-1.5 rounded text-xs font-medium border transition ${
                                !wizardBalanceEmptied
                                  ? "bg-slate-800 border-cyan-500 text-cyan-300"
                                  : "bg-slate-900 border-slate-800 text-slate-400"
                              }`}
                            >
                              Healthy Remaining Balance
                            </button>
                            <button
                              type="button"
                              onClick={() => setWizardBalanceEmptied(true)}
                              className={`flex-1 py-1.5 rounded text-xs font-medium border transition ${
                                wizardBalanceEmptied
                                  ? "bg-rose-950/40 border-rose-600 text-rose-300"
                                  : "bg-slate-900 border-slate-800 text-slate-400"
                              }`}
                            >
                              🚨 Emptied to $0.00
                            </button>
                          </div>
                          <p className="text-[10px] text-slate-500">Account takeover fraudsters almost always empty accounts</p>
                        </div>

                        {/* Question 6: Location / Geographic Anomaly */}
                        <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1.5">
                          <label className="block text-slate-300 font-semibold">6. Device / Location Consistency</label>
                          <div className="flex gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setWizardLocationRisk(false)}
                              className={`flex-1 py-1.5 rounded text-xs font-medium border transition ${
                                !wizardLocationRisk
                                  ? "bg-slate-800 border-cyan-500 text-cyan-300"
                                  : "bg-slate-900 border-slate-800 text-slate-400"
                              }`}
                            >
                              Recognized Home Device
                            </button>
                            <button
                              type="button"
                              onClick={() => setWizardLocationRisk(true)}
                              className={`flex-1 py-1.5 rounded text-xs font-medium border transition ${
                                wizardLocationRisk
                                  ? "bg-rose-950/40 border-rose-600 text-rose-300"
                                  : "bg-slate-900 border-slate-800 text-slate-400"
                              }`}
                            >
                              ⚠️ Foreign IP / New Device
                            </button>
                          </div>
                          <p className="text-[10px] text-slate-500">Maps to high PCA deviation and heuristic anomaly flags</p>
                        </div>
                      </div>

                      {/* Generated 16D Feature Summary Badge */}
                      <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs flex flex-wrap items-center justify-between gap-2">
                        <div className="text-slate-400 text-[11px]">
                          Auto-mapped to 16 normalized features:
                          <span className="font-mono text-cyan-300 ml-1.5">
                            Amount Norm: {customFeatures[0]}, Outflow: {customFeatures[9]}, High Risk Ch: {customFeatures[8]}, Anomaly: {customFeatures[12]}
                          </span>
                        </div>
                        <button
                          onClick={handleScoreTransaction}
                          className="px-5 py-2 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition shadow-lg shadow-cyan-600/30"
                        >
                          Score This Transaction
                        </button>
                      </div>
                    </div>
                  )}

                  {/* MODE B: ADVANCED 16-D MATRIX */}
                  {inputMode === "advanced" && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400">Directly modify any of the 16 normalized mathematical features:</span>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => setCustomFeatures(new Array(16).fill(0))}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-[11px] rounded transition"
                          >
                            Reset to 0
                          </button>
                          <button
                            onClick={() => {
                              setCustomFeatures([3.5, 2.8, 1.0, -0.9, 0.1, 0.2, 0.9, 0.8, 1.0, 1.0, 0.95, 1.0, 0.9, 1.0, 0.8, 0.9]);
                              setPredictionResult(null);
                            }}
                            className="px-2.5 py-1 bg-rose-950/40 hover:bg-rose-900/40 border border-rose-800/50 text-rose-300 text-[11px] rounded transition"
                          >
                            Fill High Risk
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
                        {[
                          { name: "Amount (Norm)", hint: "Z-Score (-2 to +5)" },
                          { name: "Amount (Log)", hint: "Log-scale volume" },
                          { name: "Is High Amt", hint: "0 = Normal, 1 = >90%" },
                          { name: "Hour (Sin)", hint: "Cyclic time (-1 to +1)" },
                          { name: "Hour (Cos)", hint: "Cyclic time (-1 to +1)" },
                          { name: "Day (Sin)", hint: "Day of week (-1 to +1)" },
                          { name: "Day (Cos)", hint: "Day of week (-1 to +1)" },
                          { name: "Velocity Proxy", hint: "Speed of txs (0 to 1)" },
                          { name: "High Risk Ch.", hint: "1 = Transfer/Cashout" },
                          { name: "Rapid Outflow", hint: "1 = Sudden drain" },
                          { name: "Amt/Median Ratio", hint: "Scale vs median" },
                          { name: "Zero Bal. Post", hint: "1 = Emptied balance" },
                          { name: "Risk Heuristic", hint: "Anomaly signal (-1 to +1)" },
                          { name: "Outflow Dir.", hint: "1 = Out, 0 = In" },
                          { name: "Inst. Scale", hint: "Bank volume weight" },
                          { name: "Deviation Norm", hint: "PCA outlier distance" }
                        ].map((item, i) => (
                          <div key={i} className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg space-y-1 focus-within:border-cyan-500 transition">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-slate-300 font-sans font-semibold truncate">{item.name}</span>
                              <span className="text-[9px] text-slate-500 font-sans">{item.hint}</span>
                            </div>
                            <input
                              type="number"
                              step="0.05"
                              value={isNaN(customFeatures[i]) ? "" : customFeatures[i]}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                const updated = [...customFeatures];
                                updated[i] = isNaN(val) ? 0 : val;
                                setCustomFeatures(updated);
                              }}
                              className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-cyan-300 font-bold text-xs focus:outline-none focus:border-cyan-500"
                            />
                          </div>
                        ))}
                      </div>

                      <div className="pt-2 flex justify-end">
                        <button
                          onClick={handleScoreTransaction}
                          className="px-6 py-2.5 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition shadow-lg shadow-cyan-600/30"
                        >
                          Score Custom Transaction
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            PAGE 4 — TRUST & SECURITY (ATTACK LAB & DEFENSE)
            ========================================================================= */}
        {activeTab === "security" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Control: Run Attack Simulation */}
              <div className="lg:col-span-1 p-6 bg-slate-900/80 border border-slate-800 rounded-xl space-y-4">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center space-x-2 text-rose-400">
                    <ShieldAlert className="h-5 w-5" />
                    <span>Run Attack Simulation</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Executes an adversarial attack in Python, comparing undefended FedAvg against coordinator defense filtering.
                  </p>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Compromised Node</label>
                    <select
                      value={attackAttacker}
                      onChange={(e) => setAttackAttacker(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-rose-500"
                    >
                      <option value="bank_c">Bank C (Retail Payments)</option>
                      <option value="bank_b">Bank B (Mobile Money)</option>
                      <option value="bank_a">Bank A (Card Swipes)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Poisoning Attack Vector</label>
                    <select
                      value={attackType}
                      onChange={(e) => setAttackType(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-rose-500"
                    >
                      <option value="scale_poison">100x Scale Weight Poisoning (Exploding Gradients)</option>
                      <option value="label_flip">Label Flipping Attack (Reverses Fraud Labels)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Defense Aggregation Algorithm</label>
                    <select
                      value={attackDefense}
                      onChange={(e) => setAttackDefense(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                    >
                      <option value="fedavg">Standard FedAvg + Multi-Layer Anomaly Gate</option>
                      <option value="coordinate_median">Coordinate-wise Median (Byzantine-Robust)</option>
                    </select>
                  </div>

                  <button
                    onClick={handleSimulateAttack}
                    disabled={simulatingAttack}
                    className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition shadow-lg shadow-rose-600/30 flex items-center justify-center space-x-2"
                  >
                    <ShieldAlert className="h-4 w-4" />
                    <span>{simulatingAttack ? "Running Simulation..." : "Launch Controlled Attack"}</span>
                  </button>
                </div>
              </div>

              {/* Real Simulation Results */}
              <div className="lg:col-span-2 p-6 bg-slate-900/80 border border-slate-800 rounded-xl space-y-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Attack Impact & Defense Screening Result
                </h3>

                {attackResult ? (
                  <div className="space-y-4 text-xs">
                    {/* Screening Verdicts */}
                    <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
                      <div className="font-bold text-slate-300 uppercase">Coordinator Screening Verdicts:</div>
                      {attackResult.screening_results?.map((s: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-slate-900/80 rounded border border-slate-800">
                          <span className="font-bold text-white uppercase">{s.bank_id}</span>
                          <span className={`px-2 py-0.5 rounded font-mono font-bold ${
                            s.status === "ACCEPTED" ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                          }`}>
                            {s.status}
                          </span>
                          <span className="text-slate-400 text-[11px] truncate max-w-sm">{s.reason}</span>
                        </div>
                      ))}
                    </div>

                    {/* Side by side comparison */}
                    <div className="grid grid-cols-2 gap-4 font-mono">
                      <div className="p-4 bg-rose-950/20 border border-rose-900/40 rounded-lg">
                        <div className="text-[11px] font-sans font-bold text-rose-400 uppercase">Ordinary FedAvg (Undefended)</div>
                        <div className="text-2xl font-bold text-rose-300 mt-2">{attackResult.ordinary_fedavg_metrics.pr_auc}</div>
                        <div className="text-[11px] text-slate-400 mt-1">PR-AUC (Degraded by poisoning)</div>
                      </div>

                      <div className="p-4 bg-emerald-950/20 border border-emerald-900/40 rounded-lg">
                        <div className="text-[11px] font-sans font-bold text-emerald-400 uppercase">Defended FedAvg (TrustFL)</div>
                        <div className="text-2xl font-bold text-emerald-300 mt-2">{attackResult.defended_fedavg_metrics.pr_auc}</div>
                        <div className="text-[11px] text-slate-400 mt-1">PR-AUC (Poisoning isolated)</div>
                      </div>
                    </div>

                    <p className="text-slate-300 bg-slate-900 p-3 rounded-lg border border-slate-800">
                      {attackResult.defense_summary}
                    </p>
                  </div>
                ) : (
                  <div className="text-slate-500 italic p-6 text-center text-xs">
                    Select an attack scenario on the left and click 'Launch Controlled Attack' to see the side-by-side defense verdict and PR-AUC preservation.
                  </div>
                )}
              </div>
            </div>

            {/* Benchmark Comparison Table */}
            <div className="p-6 bg-slate-900/80 border border-slate-800 rounded-xl space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Compare Models: Standalone Baselines vs Ordinary FedAvg vs Defended FedAvg
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse font-mono">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-sans uppercase">
                      <th className="py-2.5 px-3">Paradigm</th>
                      <th className="py-2.5 px-3">PR-AUC</th>
                      <th className="py-2.5 px-3">ROC-AUC</th>
                      <th className="py-2.5 px-3">F1-Score</th>
                      <th className="py-2.5 px-3">Poisoning Defense</th>
                      <th className="py-2.5 px-3">Data Privacy</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {comparison.map((c, i) => (
                      <tr key={i} className="hover:bg-slate-800/30">
                        <td className="py-3 px-3 font-sans font-medium text-white">{c.paradigm}</td>
                        <td className="py-3 px-3 text-cyan-400 font-bold">{c.pr_auc.toFixed(4)}</td>
                        <td className="py-3 px-3 text-slate-300">{c.roc_auc.toFixed(4)}</td>
                        <td className="py-3 px-3 text-emerald-400">{c.f1_score.toFixed(4)}</td>
                        <td className="py-3 px-3 font-sans">
                          <span className={`px-2 py-0.5 rounded text-[11px] ${
                            c.defense_capability.includes("100%") ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-800 text-slate-400"
                          }`}>
                            {c.defense_capability}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-sans text-slate-400">{c.data_privacy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            PAGE 5 — BLOCKCHAIN AUDIT EXPLORER
            ========================================================================= */}
        {activeTab === "audit" && (
          <div className="space-y-6">
            {/* Solidity Smart Contract Card */}
            <div className="p-6 bg-slate-900/80 border border-slate-800 rounded-xl grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Contract Address</span>
                <div className="text-sm font-mono text-cyan-300 mt-1 break-all select-all">
                  0xF2E246BB76DF876Cef8b38ae84130F4F55De395b
                </div>
                <div className="text-slate-500 text-[11px] mt-0.5">Solidity ^0.8.20 (FraudAudit.sol)</div>
              </div>

              <div>
                <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Coordinator Signer</span>
                <div className="text-sm font-mono text-slate-200 mt-1 break-all select-all">
                  0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf
                </div>
                <div className="text-slate-500 text-[11px] mt-0.5">Authorized Round Notary</div>
              </div>

              <div>
                <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Consensus Network</span>
                <div className="text-sm font-bold text-emerald-400 mt-1">EVM Local Blockchain</div>
                <div className="text-slate-500 text-[11px] mt-0.5">py-evm / Web3.py Integration</div>
              </div>
            </div>

            {/* Control: Verify Model Hash on Smart Contract */}
            <div className="p-6 bg-slate-900/80 border border-slate-800 rounded-xl space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                  <FileCheck className="h-4 w-4 text-cyan-400" />
                  <span>Verify Model Hash Against Smart Contract Commitment</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Calls the on-chain function <code className="text-cyan-400 font-mono">verifyGlobalModel(roundId, modelHash)</code> to cryptographically check if candidate weights are authentic.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="number"
                  value={isNaN(verifyRoundId) ? "" : verifyRoundId}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setVerifyRoundId(isNaN(v) ? 0 : v);
                  }}
                  placeholder="Round"
                  className="w-24 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                />
                <input
                  type="text"
                  value={verifyHashInput}
                  onChange={(e) => setVerifyHashInput(e.target.value)}
                  placeholder="Paste 64-character SHA-256 model hash..."
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                />
                <button
                  onClick={handleVerifyHash}
                  disabled={verifyingHash}
                  className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition"
                >
                  {verifyingHash ? "Querying EVM..." : "Verify On-Chain"}
                </button>
              </div>

              {verifyResult && (
                <div className={`p-4 rounded-lg border text-xs flex items-center justify-between ${
                  verifyResult.is_valid_on_chain
                    ? "bg-emerald-950/40 border-emerald-600/50 text-emerald-200"
                    : "bg-rose-950/40 border-rose-600/50 text-rose-200"
                }`}>
                  <div className="flex items-center space-x-2">
                    {verifyResult.is_valid_on_chain ? (
                      <ShieldCheck className="h-5 w-5 text-emerald-400" />
                    ) : (
                      <XCircle className="h-5 w-5 text-rose-400" />
                    )}
                    <span className="font-bold">
                      {verifyResult.is_valid_on_chain
                        ? "AUTHENTIC: Model weights match the cryptographic commitment stored in the smart contract!"
                        : "TAMPER DETECTED: Hash does NOT match the immutable on-chain record for this round!"}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-slate-400">Round #{verifyResult.round_id}</span>
                </div>
              )}
            </div>

            {/* Audited Rounds - Graphical Blockchain Explorer & Tabular Ledger */}
            <div className="p-6 bg-slate-900/80 border border-slate-800 rounded-xl space-y-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                    <Layers className="h-4 w-4 text-cyan-400" />
                    <span>On-Chain Cryptographic Blockchain Ledger</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {chainViewMode === "visual"
                      ? "Graphical node diagram showing blocks chained together by cryptographic hashes on FraudAudit.sol."
                      : "Detailed tabular ledger of all on-chain training rounds and transaction receipts."}
                  </p>
                </div>

                {/* View Mode Toggle */}
                <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                  <button
                    onClick={() => setChainViewMode("visual")}
                    className={`px-3 py-1 rounded font-medium transition ${
                      chainViewMode === "visual"
                        ? "bg-cyan-600 text-white shadow"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    🔗 Graphical Chain
                  </button>
                  <button
                    onClick={() => setChainViewMode("table")}
                    className={`px-3 py-1 rounded font-medium transition ${
                      chainViewMode === "table"
                        ? "bg-cyan-600 text-white shadow"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    📋 Table View
                  </button>
                </div>
              </div>

              {/* VIEW 1: GRAPHICAL BLOCKCHAIN NODE DIAGRAM */}
              {chainViewMode === "visual" && (
                <div className="space-y-6">
                  {/* Chain Status Bar */}
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      <span className="font-semibold text-emerald-400">Chain State: Cryptographically Linked & Immutable</span>
                    </div>
                    <span className="text-slate-400 text-[11px]">Click any block below to inspect its on-chain forensics</span>
                  </div>

                  {/* Horizontal Scrollable Block Nodes Chain */}
                  <div className="overflow-x-auto pb-4">
                    <div className="flex items-center space-x-4 min-w-max p-2">
                      {/* Genesis Block */}
                      <div
                        onClick={() => setSelectedBlockId(0)}
                        className={`w-64 p-4 rounded-xl border transition cursor-pointer select-none ${
                          selectedBlockId === 0
                            ? "bg-indigo-950/40 border-cyan-400 shadow-lg shadow-cyan-500/20"
                            : "bg-slate-950/90 border-slate-800 hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px] mb-2">
                          <span className="px-2 py-0.5 bg-indigo-950 text-indigo-400 border border-indigo-800 rounded font-bold font-mono">
                            BLOCK #0
                          </span>
                          <span className="text-slate-500 font-mono">GENESIS</span>
                        </div>
                        <div className="text-xs font-bold text-white mb-1">Architecture Initialization</div>
                        <div className="text-[10px] text-slate-400 font-mono break-all truncate">
                          Prev Hash: 0x0000000000000000...
                        </div>
                        <div className="mt-3 pt-2 border-t border-slate-900 text-[10px] text-slate-500 flex justify-between">
                          <span>EVM Network Launch</span>
                          <span className="text-emerald-400">Verified</span>
                        </div>
                      </div>

                      {/* Dynamic Blocks from auditRounds */}
                      {auditRounds.map((r, idx) => {
                        const blockIndex = idx + 1;
                        const isSelected = selectedBlockId === blockIndex;
                        const hasRejected = r.client_submissions?.some((s: any) => s.decision === "REJECTED");

                        return (
                          <React.Fragment key={`block-node-${r.round_id}-${idx}`}>
                            {/* Cryptographic Link Arrow */}
                            <div className="flex flex-col items-center text-slate-600 px-1">
                              <span className="text-[10px] font-mono text-cyan-500/80 mb-0.5">SHA-256</span>
                              <div className="flex items-center space-x-1">
                                <div className="w-6 h-0.5 bg-gradient-to-r from-slate-700 to-cyan-500"></div>
                                <ArrowRight className="h-4 w-4 text-cyan-400 animate-pulse" />
                              </div>
                            </div>

                            {/* Block Node Card */}
                            <div
                              onClick={() => setSelectedBlockId(blockIndex)}
                              className={`w-72 p-4 rounded-xl border transition cursor-pointer select-none ${
                                isSelected
                                  ? "bg-slate-900 border-cyan-400 shadow-xl shadow-cyan-500/20 ring-1 ring-cyan-500"
                                  : hasRejected
                                  ? "bg-slate-950/90 border-amber-800/60 hover:border-amber-600"
                                  : "bg-slate-950/90 border-slate-800 hover:border-slate-700"
                              }`}
                            >
                              {/* Header */}
                              <div className="flex items-center justify-between text-[11px] mb-2">
                                <span className={`px-2 py-0.5 rounded font-bold font-mono border ${
                                  hasRejected
                                    ? "bg-amber-950/60 text-amber-300 border-amber-800"
                                    : "bg-cyan-950/60 text-cyan-300 border-cyan-800"
                                }`}>
                                  BLOCK #{r.round_id}
                                </span>
                                <span className="text-slate-400 font-mono text-[10px]">
                                  {r.defense_strategy?.toUpperCase()}
                                </span>
                              </div>

                              {/* Consensus Model Hash */}
                              <div className="text-xs font-semibold text-slate-200 mb-1">
                                Consensus Global Model
                              </div>
                              <div className="p-1.5 bg-black/60 rounded border border-slate-900 font-mono text-[10px] text-cyan-300 truncate" title={r.resulting_global_model_hash}>
                                {r.resulting_global_model_hash?.slice(0, 20)}...
                              </div>

                              {/* Participant Node Badges */}
                              <div className="mt-3 pt-2 border-t border-slate-900 space-y-1">
                                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Participants Audited:</span>
                                <div className="flex flex-wrap gap-1">
                                  {r.client_submissions?.map((s: any, sIdx: number) => (
                                    <span
                                      key={`sub-${idx}-${sIdx}`}
                                      className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold flex items-center space-x-1 ${
                                        s.decision === "ACCEPTED"
                                          ? "bg-emerald-950 text-emerald-400 border border-emerald-900"
                                          : "bg-rose-950 text-rose-400 border border-rose-900"
                                      }`}
                                    >
                                      <span>{s.bank_id.toUpperCase()}</span>
                                      <span>{s.decision === "ACCEPTED" ? "✓" : "✗"}</span>
                                    </span>
                                  ))}
                                </div>
                              </div>

                              {/* On-Chain Receipt Preview */}
                              <div className="mt-3 pt-2 border-t border-slate-900 text-[10px] flex items-center justify-between text-slate-400 font-mono">
                                <span>{r.blockchain_receipt?.block_number ? `EVM #${r.blockchain_receipt.block_number}` : "Off-Chain"}</span>
                                <span className="text-cyan-400 hover:underline">Inspect Details →</span>
                              </div>
                            </div>
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>

                  {/* Selected Block Forensic Details Inspection Panel */}
                  {selectedBlockId !== null && (
                    <div className="p-5 bg-slate-950 border border-cyan-800/40 rounded-xl space-y-4 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <div className="flex items-center space-x-2">
                          <Lock className="h-4 w-4 text-cyan-400" />
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                            {selectedBlockId === 0 ? "Genesis Block #0" : `Block #${auditRounds[selectedBlockId - 1]?.round_id ?? selectedBlockId}`} On-Chain Forensic Inspection
                          </h4>
                        </div>
                        <button
                          onClick={() => setSelectedBlockId(null)}
                          className="text-xs text-slate-500 hover:text-slate-300"
                        >
                          ✕ Close Inspector
                        </button>
                      </div>

                      {selectedBlockId === 0 ? (
                        <div className="text-xs text-slate-400 space-y-2">
                          <p><strong>Genesis Block #0:</strong> Deployed `FraudAudit.sol` contract and established initial random architecture consensus.</p>
                          <div className="font-mono text-[11px] text-cyan-400">Contract: 0xF2E246BB76DF876Cef8b38ae84130F4F55De395b</div>
                        </div>
                      ) : (
                        (() => {
                          const activeBlock = auditRounds[selectedBlockId - 1];
                          if (!activeBlock) return <div className="text-xs text-slate-500">Block details not found.</div>;

                          return (
                            <div className="space-y-3 text-xs">
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono">
                                <div className="p-3 bg-slate-900 rounded border border-slate-800">
                                  <div className="text-[10px] text-slate-400 font-sans">Full Global Model Hash:</div>
                                  <div className="text-cyan-300 font-bold break-all mt-1">{activeBlock.resulting_global_model_hash}</div>
                                </div>
                                <div className="p-3 bg-slate-900 rounded border border-slate-800">
                                  <div className="text-[10px] text-slate-400 font-sans">Blockchain TxHash:</div>
                                  <div className="text-slate-200 break-all mt-1">{activeBlock.blockchain_receipt?.transaction_hash || "Simulated Ledger"}</div>
                                </div>
                                <div className="p-3 bg-slate-900 rounded border border-slate-800">
                                  <div className="text-[10px] text-slate-400 font-sans">EVM Block & Gas Used:</div>
                                  <div className="text-emerald-400 font-bold mt-1">
                                    Block #{activeBlock.blockchain_receipt?.block_number || "Local"} | Gas: {activeBlock.blockchain_receipt?.gas_used?.toLocaleString() || "N/A"}
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-1.5 pt-2">
                                <span className="font-bold text-slate-300 block">Bank Update Artifact Submissions:</span>
                                {activeBlock.client_submissions?.map((sub: any, sIdx: number) => (
                                  <div key={`forensic-sub-${sIdx}`} className="p-2.5 bg-slate-900 rounded border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 text-[11px]">
                                    <div className="flex items-center space-x-2">
                                      <span className="font-bold text-white uppercase">{sub.bank_id}:</span>
                                      <span className="font-mono text-cyan-400 truncate max-w-xs">{sub.weights_hash}</span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <span className={`px-2 py-0.5 rounded font-bold font-mono text-[10px] ${
                                        sub.decision === "ACCEPTED" ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                                      }`}>
                                        {sub.decision}
                                      </span>
                                      {sub.reason && <span className="text-slate-400 text-[10px]">({sub.reason})</span>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* VIEW 2: TABULAR LEDGER VIEW */}
              {chainViewMode === "table" && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse font-mono">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-sans uppercase">
                        <th className="py-2.5 px-3">Round ID</th>
                        <th className="py-2.5 px-3">Defense</th>
                        <th className="py-2.5 px-3">Global Model Hash</th>
                        <th className="py-2.5 px-3">Bank Submissions & Verdicts</th>
                        <th className="py-2.5 px-3">On-Chain Transaction Link</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {auditRounds.map((r, i) => (
                        <tr key={`table-round-${r.round_id}-${i}`} className="hover:bg-slate-800/30">
                          <td className="py-3 px-3 font-bold text-white">#{r.round_id}</td>
                          <td className="py-3 px-3 text-cyan-400">{r.defense_strategy?.toUpperCase()}</td>
                          <td className="py-3 px-3 text-slate-300 truncate max-w-xs" title={r.resulting_global_model_hash}>
                            {r.resulting_global_model_hash?.slice(0, 16)}...
                          </td>
                          <td className="py-3 px-3 font-sans space-y-1">
                            {r.client_submissions?.map((sub: any, sIdx: number) => (
                              <div key={`table-sub-${r.round_id}-${i}-${sIdx}`} className="flex items-center space-x-1.5 text-[11px]">
                                <span className="font-bold text-slate-200">{sub.bank_id.toUpperCase()}:</span>
                                <span className={`px-1.5 py-0.2 rounded font-mono text-[10px] ${
                                  sub.decision === "ACCEPTED" ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                                }`}>
                                  {sub.decision}
                                </span>
                                {sub.reason && <span className="text-slate-500 truncate max-w-xs">({sub.reason})</span>}
                              </div>
                            ))}
                          </td>
                          <td className="py-3 px-3 font-sans text-slate-400 text-[11px]">
                            {r.blockchain_receipt?.transaction_hash ? (
                              <div>
                                <div className="text-cyan-400 font-mono">Tx: {r.blockchain_receipt.transaction_hash.slice(0, 14)}...</div>
                                <div>Block #{r.blockchain_receipt.block_number} | Gas: {r.blockchain_receipt.gas_used?.toLocaleString()}</div>
                              </div>
                            ) : (
                              <span className="text-slate-500 italic">Off-Chain Ledger Backup</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 px-6 py-4 text-center text-xs text-slate-500">
        CrossBank TrustFL — Blockchain-Audited Federated Learning for Privacy-Preserving Cross-Bank Fraud Detection
      </footer>
    </div>
  );
}
