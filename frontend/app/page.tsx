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
    const medianAmt = 150;
    const amtNorm = Math.min(Math.max((amt - medianAmt) / 500, -2.0), 6.0);
    const amtLog = Math.log1p(Math.max(amt, 0)) / 10.0;
    const isHighAmt = amt > 1000 || unusualAmt ? 1.0 : 0.0;

    let hour = 14;
    if (timeOfDay === "midnight") hour = 3;
    else if (timeOfDay === "morning") hour = 9;
    else if (timeOfDay === "evening") hour = 23;
    const hourSin = Math.sin((2 * Math.PI * hour) / 24);
    const hourCos = Math.cos((2 * Math.PI * hour) / 24);
    const daySin = 0.43;
    const dayCos = 0.90;
    const velocityProxy = unusualAmt ? 0.85 : 0.25;

    const isHighRiskChannel = channel === "transfer" || channel === "cashout" || channel === "crypto" ? 1.0 : 0.0;
    const rapidOutflow = balanceEmptied || unusualAmt ? 1.0 : 0.0;
    const ratioToMedian = Math.min(amt / medianAmt, 50) / 50.0;
    const zeroBal = balanceEmptied ? 1.0 : 0.0;

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

  const [selectedSample, setSelectedSample] = useState<any>(null);
  const [customFeatures, setCustomFeatures] = useState<number[]>(new Array(16).fill(0));
  const [threshold, setThreshold] = useState(0.5);
  const [predictionResult, setPredictionResult] = useState<any>(null);
  const [evaluatingDataset, setEvaluatingDataset] = useState(false);
  const [datasetEvalResult, setDatasetEvalResult] = useState<any>(null);
  const [chosenDatasetKey, setChosenDatasetKey] = useState("bank_a");

  const [verifyRoundId, setVerifyRoundId] = useState(1);
  const [verifyHashInput, setVerifyHashInput] = useState("");
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [verifyingHash, setVerifyingHash] = useState(false);

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
        setSelectedSample(smp.samples[1]);
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

  const handleScoreTransaction = async () => {
    try {
      const res = await api.predictFraud(customFeatures, threshold);
      setPredictionResult(res);
    } catch (err: any) {
      alert("Inference failed: " + err.message);
    }
  };

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
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col font-sans">
      {/* Top Navigation */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-50 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-gradient-to-tr from-amber-600 to-amber-500 rounded-xl shadow-md shadow-amber-500/20">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold tracking-tight text-[#0F172A]">CrossBank TrustFL</h1>
              <span className="px-2 py-0.5 text-[10px] bg-amber-500 text-white rounded font-bold uppercase tracking-wider">
                Live Prototype
              </span>
            </div>
            <p className="text-xs text-slate-600">Privacy-Preserving Federated Learning & Blockchain Audit for Multi-Bank Fraud Detection</p>
          </div>
        </div>

        {/* Backend & Chain Status Badges */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 bg-emerald-100 border border-emerald-300 rounded-full px-3.5 py-1.5 shadow-sm">
            <span className={`w-2.5 h-2.5 rounded-full ${backendOnline ? "bg-emerald-600 animate-pulse" : "bg-rose-600"}`}></span>
            <span className="text-xs font-bold text-emerald-900">
              Backend: {backendOnline ? "Live (FastAPI :8000)" : "Connecting..."}
            </span>
          </div>

          <div className="flex items-center space-x-2 bg-amber-100 border border-amber-300 rounded-full px-3.5 py-1.5 shadow-sm">
            <Lock className="w-3.5 h-3.5 text-amber-900" />
            <span className="text-xs font-bold text-amber-950">Solidity EVM On-Chain</span>
          </div>

          <button
            onClick={() => { refreshLiveStatus(); loadInitialData(); }}
            className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition shadow-sm"
            title="Refresh from Backend"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Main Tabs Navigation */}
      <div className="border-b border-slate-200 bg-white px-6 flex space-x-2 shadow-sm">
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
              className={`flex items-center space-x-2 px-5 py-3.5 text-xs font-bold border-b-2 transition ${
                isActive
                  ? "border-amber-600 text-amber-900 bg-amber-50"
                  : "border-transparent text-slate-600 hover:text-[#0F172A] hover:bg-slate-50"
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
            <div className="p-4 bg-gradient-to-r from-amber-100 via-yellow-100 to-emerald-100 border-2 border-amber-300 rounded-xl flex items-center justify-between text-xs text-amber-950 shadow-sm">
              <span className="flex items-center space-x-2.5">
                <CheckCircle2 className="h-5 w-5 text-amber-700" />
                <span className="font-medium text-sm"><strong>Core Architecture:</strong> 3 banks train local models on private datasets and share only weight updates (not raw transactions) securely via smart contracts.</span>
              </span>
              <span className="px-3 py-1.5 bg-emerald-700 text-white rounded-lg font-mono font-bold text-xs shadow-sm">100% Privacy Preserved</span>
            </div>

            {/* Stat Cards with Rich, High-Contrast Colorful Backgrounds */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              <div className="p-5 bg-gradient-to-br from-amber-100 to-amber-50 border-2 border-amber-300 rounded-xl shadow-sm">
                <div className="flex items-center justify-between text-amber-900 text-xs font-bold uppercase tracking-wider">
                  <span>Current Global Round</span>
                  <Activity className="h-5 w-5 text-amber-700" />
                </div>
                <div className="mt-2 text-3xl font-extrabold text-[#0F172A]">Round {status?.current_round ?? 0}</div>
                <div className="mt-2 flex items-center space-x-1.5 text-xs text-emerald-800 font-bold bg-emerald-200/60 px-2 py-0.5 rounded w-fit">
                  <Check className="h-3.5 w-3.5" />
                  <span>Consensus converged</span>
                </div>
              </div>

              <div className="p-5 bg-gradient-to-br from-sky-100 to-sky-50 border-2 border-sky-300 rounded-xl shadow-sm">
                <div className="flex items-center justify-between text-sky-900 text-xs font-bold uppercase tracking-wider">
                  <span>Participating Banks</span>
                  <Database className="h-5 w-5 text-sky-700" />
                </div>
                <div className="mt-2 text-3xl font-extrabold text-[#0F172A]">3 Nodes</div>
                <p className="mt-1 text-xs text-sky-900 font-medium">Bank A, Bank B, Bank C</p>
              </div>

              <div className="p-5 bg-gradient-to-br from-yellow-100 to-amber-50 border-2 border-yellow-300 rounded-xl shadow-sm">
                <div className="flex items-center justify-between text-yellow-900 text-xs font-bold uppercase tracking-wider">
                  <span>On-Chain Audited Rounds</span>
                  <Layers className="h-5 w-5 text-amber-800" />
                </div>
                <div className="mt-2 text-3xl font-extrabold text-[#0F172A]">{status?.total_audited_rounds ?? 0} Committed</div>
                <p className="mt-1 text-xs text-yellow-900 font-medium">Stored on FraudAudit.sol</p>
              </div>

              <div className="p-5 bg-gradient-to-br from-emerald-100 to-emerald-50 border-2 border-emerald-300 rounded-xl shadow-sm">
                <div className="flex items-center justify-between text-emerald-900 text-xs font-bold uppercase tracking-wider">
                  <span>Active Model Size</span>
                  <Cpu className="h-5 w-5 text-emerald-700" />
                </div>
                <div className="mt-2 text-3xl font-extrabold text-emerald-950">3,393 Weights</div>
                <p className="mt-1 text-xs text-emerald-900 font-medium">16-dim Universal MLP</p>
              </div>
            </div>

            {/* Global Model Fingerprint Card */}
            <div className="p-6 bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 border-2 border-amber-600/50 rounded-xl space-y-3 shadow-lg text-white">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-300">Active Global Model Fingerprint (SHA-256)</span>
                <span className="px-3 py-1 bg-emerald-500 text-slate-950 font-bold rounded-lg text-xs shadow">
                  Verified On-Chain
                </span>
              </div>
              <div className="p-3.5 bg-black/70 border border-amber-500/40 rounded-lg font-mono text-xs text-amber-400 break-all select-all shadow-inner">
                {status?.active_global_model_hash ?? "Loading live model hash..."}
              </div>
            </div>

            {/* Participating Bank Cards with Rich, Distinct Background Colors */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-[#0F172A]">Three Participating Simulated Banks</h2>
                <span className="text-xs text-emerald-900 font-bold bg-emerald-100 border border-emerald-300 px-3.5 py-1.5 rounded-xl shadow-sm">
                  🛡️ Raw transaction datasets remain 100% private locally
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {banks.map((b, idx) => {
                  const cardStyles = [
                    "bg-gradient-to-br from-sky-100 via-white to-white border-2 border-sky-300 shadow-sm",
                    "bg-gradient-to-br from-amber-100 via-white to-white border-2 border-amber-300 shadow-sm",
                    "bg-gradient-to-br from-purple-100 via-white to-white border-2 border-purple-300 shadow-sm"
                  ];
                  return (
                    <div key={b.id} className={`p-6 rounded-xl space-y-3 ${cardStyles[idx % cardStyles.length]}`}>
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-[#0F172A] text-sm">{b.name}</span>
                        <span className="px-3 py-0.5 text-xs bg-emerald-600 text-white rounded-full font-bold shadow-sm">
                          {b.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-700 font-semibold">{b.dataset_source}</div>

                      <div className="space-y-2 text-xs pt-3 border-t border-slate-300 font-mono">
                        <div className="flex justify-between">
                          <span className="text-slate-600 font-sans font-medium">Private Records:</span>
                          <span className="text-[#0F172A] font-bold">{b.records.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600 font-sans font-medium">Fraud Cases:</span>
                          <span className="text-rose-700 font-bold">{b.fraud_count.toLocaleString()} ({b.fraud_rate_pct}%)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600 font-sans font-medium">Shared Updates:</span>
                          <span className="text-amber-900 font-bold">Weights Only</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
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
            <div className="lg:col-span-1 p-6 bg-gradient-to-br from-amber-100 via-yellow-50 to-white border-2 border-amber-300 rounded-xl space-y-5 shadow-sm">
              <div>
                <h2 className="text-base font-bold text-[#0F172A] flex items-center space-x-2">
                  <Play className="h-5 w-5 text-amber-700" />
                  <span>Start Training Round</span>
                </h2>
                <p className="text-xs text-slate-700 mt-1 font-medium">
                  Triggers local client training across all 3 banks, runs coordinator defense screening, and updates the global model on-chain without exposing private data.
                </p>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-900 font-bold mb-1">Round ID to Train</label>
                  <input
                    type="number"
                    value={isNaN(trainRoundId) ? "" : trainRoundId}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      setTrainRoundId(isNaN(v) ? 0 : v);
                    }}
                    className="w-full bg-white border-2 border-slate-300 rounded-lg px-3 py-2.5 text-[#0F172A] font-mono font-bold focus:outline-none focus:border-amber-600 shadow-sm"
                  />
                </div>

                <div>
                  <label className="block text-slate-900 font-bold mb-1">Defense & Aggregation Strategy</label>
                  <select
                    value={trainDefense}
                    onChange={(e) => setTrainDefense(e.target.value)}
                    className="w-full bg-white border-2 border-slate-300 rounded-lg px-3 py-2.5 text-[#0F172A] font-medium focus:outline-none focus:border-amber-600 shadow-sm"
                  >
                    <option value="fedavg">Sample-Weighted FedAvg (Standard)</option>
                    <option value="coordinate_median">Coordinate-wise Median (Byzantine-Robust)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-900 font-bold mb-1">Local Training Epochs</label>
                  <select
                    value={trainEpochs}
                    onChange={(e) => setTrainEpochs(parseInt(e.target.value))}
                    className="w-full bg-white border-2 border-slate-300 rounded-lg px-3 py-2.5 text-[#0F172A] font-medium focus:outline-none focus:border-amber-600 shadow-sm"
                  >
                    <option value={1}>1 Local Epoch</option>
                    <option value={2}>2 Local Epochs</option>
                  </select>
                </div>

                <button
                  onClick={handleStartTraining}
                  disabled={loading || trainingStatus?.status === "RUNNING"}
                  className={`w-full py-3.5 rounded-xl font-extrabold text-xs uppercase tracking-wider transition flex items-center justify-center space-x-2 shadow-md ${
                    trainingStatus?.status === "RUNNING"
                      ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                      : "bg-amber-600 hover:bg-amber-500 text-white"
                  }`}
                >
                  <Play className="h-4 w-4" />
                  <span>{trainingStatus?.status === "RUNNING" ? "Round In Progress..." : "Execute Training Round"}</span>
                </button>
              </div>

              <div className="p-4 bg-white border-2 border-amber-200 rounded-xl text-xs space-y-1.5 font-mono shadow-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600 font-bold">Coordinator Status:</span>
                  <span className="text-amber-800 font-extrabold">{trainingStatus?.status ?? "IDLE"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 font-bold">Progress:</span>
                  <span className="text-[#0F172A] font-extrabold">{trainingStatus?.progress_percent ?? 0}%</span>
                </div>
              </div>
            </div>

            {/* Live Progress & Log Stream */}
            <div className="lg:col-span-2 space-y-6">
              <div className="p-6 bg-gradient-to-br from-emerald-100 via-white to-white border-2 border-emerald-300 rounded-xl space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider">Round Progression</h3>
                    <p className="text-xs text-slate-700 font-medium mt-0.5">{trainingStatus?.current_step ?? "Idle — Ready for federation round"}</p>
                  </div>
                  <span className="px-3 py-1.5 text-xs rounded-full font-extrabold bg-emerald-700 text-white shadow-sm">
                    {trainingStatus?.progress_percent ?? 0}% Completed
                  </span>
                </div>

                <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden shadow-inner">
                  <div
                    className="bg-gradient-to-r from-amber-500 to-emerald-600 h-full transition-all duration-300"
                    style={{ width: `${trainingStatus?.progress_percent ?? 0}%` }}
                  ></div>
                </div>

                <div className="grid grid-cols-4 text-center text-[11px] text-slate-800 pt-1 font-bold">
                  <div>1. Local Training</div>
                  <div>2. Defense Screen</div>
                  <div>3. Parameter Aggregation</div>
                  <div>4. Smart Contract Commit</div>
                </div>
              </div>

              {/* Terminal Logs */}
              <div className="p-5 bg-slate-950 border-2 border-slate-800 rounded-xl font-mono text-xs text-slate-200 space-y-2 shadow-xl">
                <div className="flex items-center space-x-2 text-amber-400 pb-2 border-b border-slate-800">
                  <Terminal className="h-4 w-4" />
                  <span className="font-bold text-white">Live Training & Defense Execution Log</span>
                </div>
                <div className="h-64 overflow-y-auto space-y-1.5 pt-2 text-slate-300">
                  {trainingStatus?.logs && trainingStatus.logs.length > 0 ? (
                    trainingStatus.logs.map((log: string, idx: number) => (
                      <div key={idx} className="leading-relaxed">
                        <span className="text-amber-400 font-bold">[{idx + 1}]</span> {log}
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
            <div className="p-6 bg-gradient-to-br from-indigo-100 via-white to-white border-2 border-indigo-300 rounded-xl space-y-4 shadow-sm">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-[#0F172A] flex items-center space-x-2">
                    <BarChart3 className="h-5 w-5 text-indigo-700" />
                    <span>Evaluate Global Model on Labelled Test Dataset</span>
                  </h2>
                  <p className="text-xs text-slate-700 font-medium mt-0.5">
                    Evaluates the collaborative Global MLP across held-out test splits, combining knowledge from all 3 banks without sharing raw records.
                  </p>
                </div>

                <div className="flex items-center space-x-3">
                  <select
                    value={chosenDatasetKey}
                    onChange={(e) => setChosenDatasetKey(e.target.value)}
                    className="bg-white border-2 border-slate-300 rounded-lg px-3.5 py-2 text-xs text-[#0F172A] font-bold focus:outline-none focus:border-indigo-600 shadow-sm"
                  >
                    <option value="bank_a">Bank A (Credit Card Test Split)</option>
                    <option value="bank_b">Bank B (PaySim Mobile Test Split)</option>
                    <option value="bank_c">Bank C (BankSim Retail Test Split)</option>
                  </select>

                  <button
                    onClick={handleEvaluateDataset}
                    disabled={evaluatingDataset}
                    className="px-5 py-2.5 bg-indigo-700 hover:bg-indigo-600 text-white font-extrabold text-xs rounded-lg transition shadow-md shadow-indigo-500/20"
                  >
                    {evaluatingDataset ? "Evaluating on Disk..." : "Run Test Set Evaluation"}
                  </button>
                </div>
              </div>

              {datasetEvalResult && (
                <div className="p-5 bg-white border-2 border-indigo-300 rounded-xl space-y-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-sm text-indigo-950">{datasetEvalResult.dataset_name}</span>
                    <span className="text-xs font-mono font-bold text-slate-600">
                      Evaluated: {datasetEvalResult.evaluated_samples.toLocaleString()} transactions ({datasetEvalResult.actual_frauds_in_test} frauds)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 font-mono">
                    <div className="p-3.5 bg-amber-100 border-2 border-amber-300 rounded-xl text-center shadow-sm">
                      <div className="text-[10px] text-amber-900 font-sans uppercase font-extrabold">PR-AUC</div>
                      <div className="text-lg font-black text-amber-950 mt-1">{datasetEvalResult.pr_auc}</div>
                    </div>
                    <div className="p-3.5 bg-slate-100 border-2 border-slate-300 rounded-xl text-center shadow-sm">
                      <div className="text-[10px] text-slate-700 font-sans uppercase font-extrabold">ROC-AUC</div>
                      <div className="text-lg font-black text-[#0F172A] mt-1">{datasetEvalResult.roc_auc}</div>
                    </div>
                    <div className="p-3.5 bg-emerald-100 border-2 border-emerald-300 rounded-xl text-center shadow-sm">
                      <div className="text-[10px] text-emerald-900 font-sans uppercase font-extrabold">F1-Score</div>
                      <div className="text-lg font-black text-emerald-950 mt-1">{datasetEvalResult.f1_score}</div>
                    </div>
                    <div className="p-3.5 bg-slate-100 border-2 border-slate-300 rounded-xl text-center shadow-sm">
                      <div className="text-[10px] text-slate-700 font-sans uppercase font-extrabold">Precision</div>
                      <div className="text-lg font-black text-[#0F172A] mt-1">{datasetEvalResult.precision}</div>
                    </div>
                    <div className="p-3.5 bg-amber-100 border-2 border-amber-300 rounded-xl text-center shadow-sm">
                      <div className="text-[10px] text-amber-900 font-sans uppercase font-extrabold">Recall</div>
                      <div className="text-lg font-black text-amber-950 mt-1">{datasetEvalResult.recall}</div>
                    </div>
                  </div>

                  {datasetEvalResult.confusion_matrix && (
                    <div className="text-xs text-slate-700 font-medium flex items-center justify-between pt-2 border-t border-slate-200">
                      <span>Confusion Matrix: [TN: {datasetEvalResult.confusion_matrix[0][0]}, FP: {datasetEvalResult.confusion_matrix[0][1]}, FN: {datasetEvalResult.confusion_matrix[1][0]}, TP: {datasetEvalResult.confusion_matrix[1][1]}]</span>
                      <span className="text-emerald-800 font-bold">Real Evaluation on Live Data</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1 p-6 bg-gradient-to-br from-amber-100 via-white to-white border-2 border-amber-300 rounded-xl space-y-4 shadow-sm">
                <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider flex items-center space-x-2">
                  <Search className="h-4 w-4 text-amber-800" />
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
                      className={`w-full text-left p-3.5 rounded-xl border-2 text-xs transition shadow-sm ${
                        selectedSample?.id === s.id
                          ? "bg-amber-200 border-amber-600 text-amber-950 font-bold"
                          : "bg-white border-slate-300 text-slate-700 hover:border-slate-400 font-medium"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-extrabold text-amber-950">{s.bank}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold shadow-sm ${
                          s.ground_truth === "Fraud" ? "bg-rose-600 text-white" : "bg-emerald-600 text-white"
                        }`}>
                          {s.ground_truth}
                        </span>
                      </div>
                      <p className="text-slate-600 text-[11px] leading-tight font-medium">{s.description}</p>
                    </button>
                  ))}
                </div>

                <div className="pt-3 border-t border-slate-300 text-xs">
                  <div className="flex justify-between text-slate-800 font-bold mb-1">
                    <span>Decision Threshold:</span>
                    <span className="font-mono text-amber-900 font-extrabold">{threshold.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="0.9"
                    step="0.05"
                    value={threshold}
                    onChange={(e) => setThreshold(parseFloat(e.target.value))}
                    className="w-full accent-amber-600 cursor-pointer"
                  />
                </div>

                <button
                  onClick={handleScoreTransaction}
                  className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition shadow-md shadow-amber-500/20"
                >
                  Score with Global MLP
                </button>
              </div>

              <div className="lg:col-span-2 space-y-6">
                {predictionResult && (
                  <div className={`p-6 border-2 rounded-xl flex items-center justify-between shadow-md ${
                    predictionResult.is_fraud
                      ? "bg-rose-100 border-rose-400 text-rose-950"
                      : "bg-emerald-100 border-emerald-400 text-emerald-950"
                  }`}>
                    <div>
                      <div className="flex items-center space-x-2.5">
                        {predictionResult.is_fraud ? (
                          <AlertTriangle className="h-6 w-6 text-rose-700" />
                        ) : (
                          <CheckCircle2 className="h-6 w-6 text-emerald-700" />
                        )}
                        <span className="text-xl font-extrabold tracking-tight">
                          {predictionResult.is_fraud ? "FRAUD DETECTED" : "TRANSACTION APPROVED"}
                        </span>
                        <span className={`px-2.5 py-1 text-xs font-black border rounded-full shadow-sm ${
                          predictionResult.is_fraud ? "bg-rose-600 text-white border-rose-700" : "bg-emerald-600 text-white border-emerald-700"
                        }`}>
                          {predictionResult.risk_tier} RISK
                        </span>
                      </div>
                      <p className="text-xs text-slate-800 font-medium mt-1.5 max-w-lg">{predictionResult.explanation}</p>
                    </div>

                    <div className="text-right">
                      <div className="text-xs uppercase text-slate-700 font-bold">Fraud Probability</div>
                      <div className="text-3xl font-black font-mono text-[#0F172A]">
                        {(predictionResult.fraud_probability * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                )}

                <div className="p-6 bg-white border-2 border-slate-300 rounded-xl space-y-4 shadow-sm">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                    <div>
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#0F172A]">
                        Create Custom Transaction Simulator
                      </h4>
                      <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                        {inputMode === "wizard"
                          ? "Answer simple everyday banking questions; the system converts them into normalized ML inputs."
                          : "Directly edit all 16 normalized feature parameters (Advanced ML mode)."}
                      </p>
                    </div>

                    <div className="flex bg-slate-100 p-1 rounded-xl border-2 border-slate-200 text-xs shadow-inner">
                      <button
                        onClick={() => setInputMode("wizard")}
                        className={`px-3.5 py-1.5 rounded-lg font-bold transition ${
                          inputMode === "wizard"
                            ? "bg-amber-600 text-white shadow"
                            : "text-slate-700 hover:text-[#0F172A]"
                        }`}
                      >
                        🧙 Simple Questions
                      </button>
                      <button
                        onClick={() => setInputMode("advanced")}
                        className={`px-3.5 py-1.5 rounded-lg font-bold transition ${
                          inputMode === "advanced"
                            ? "bg-amber-600 text-white shadow"
                            : "text-slate-700 hover:text-[#0F172A]"
                        }`}
                      >
                        ⚙️ Advanced 16-D
                      </button>
                    </div>
                  </div>

                  {inputMode === "wizard" && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                        <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-xl space-y-1.5 shadow-sm">
                          <label className="block text-[#0F172A] font-bold">1. Transaction Amount ($ USD)</label>
                          <input
                            type="number"
                            min="1"
                            value={wizardAmount}
                            onChange={(e) => setWizardAmount(Math.max(1, parseFloat(e.target.value) || 0))}
                            className="w-full bg-white border-2 border-slate-300 rounded-lg px-3 py-2 text-[#0F172A] font-mono font-bold text-sm focus:outline-none focus:border-amber-600 shadow-sm"
                          />
                          <p className="text-[10px] text-slate-600 font-medium">e.g. $25 for coffee, $2,500 for wire transfer</p>
                        </div>

                        <div className="p-4 bg-sky-50 border-2 border-sky-300 rounded-xl space-y-1.5 shadow-sm">
                          <label className="block text-[#0F172A] font-bold">2. Transaction Type / Channel</label>
                          <select
                            value={wizardChannel}
                            onChange={(e) => setWizardChannel(e.target.value)}
                            className="w-full bg-white border-2 border-slate-300 rounded-lg px-3 py-2 text-[#0F172A] font-bold text-xs focus:outline-none focus:border-sky-600 shadow-sm"
                          >
                            <option value="card_swipe">In-Store Card Swipe (Bank A)</option>
                            <option value="online_pay">Online Merchant Payment (Bank C)</option>
                            <option value="transfer">Mobile Money Wire Transfer (Bank B - High Risk)</option>
                            <option value="cashout">Instant Cash-Out / ATM (Bank B - High Risk)</option>
                            <option value="crypto">Luxury Merchant / Jewelry (Bank C - High Risk)</option>
                          </select>
                          <p className="text-[10px] text-slate-600 font-medium">Wires & Cash-outs carry inherently higher fraud risk</p>
                        </div>

                        <div className="p-4 bg-purple-50 border-2 border-purple-300 rounded-xl space-y-1.5 shadow-sm">
                          <label className="block text-[#0F172A] font-bold">3. Time of Transaction</label>
                          <select
                            value={wizardTime}
                            onChange={(e) => setWizardTime(e.target.value)}
                            className="w-full bg-white border-2 border-slate-300 rounded-lg px-3 py-2 text-[#0F172A] font-bold text-xs focus:outline-none focus:border-purple-600 shadow-sm"
                          >
                            <option value="morning">Morning (9:00 AM — Business Hours)</option>
                            <option value="afternoon">Afternoon (2:00 PM — Normal Day)</option>
                            <option value="evening">Late Evening (11:00 PM)</option>
                            <option value="midnight">Dead of Night (3:00 AM — High Risk Spike)</option>
                          </select>
                          <p className="text-[10px] text-slate-600 font-medium">Midnight transactions trigger temporal anomaly signals</p>
                        </div>

                        <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-xl space-y-1.5 shadow-sm">
                          <label className="block text-[#0F172A] font-bold">4. Customer Spending Behavior</label>
                          <div className="flex gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setWizardIsUnusualAmt(false)}
                              className={`flex-1 py-2 rounded-lg text-xs font-bold border-2 transition ${
                                !wizardIsUnusualAmt
                                  ? "bg-emerald-600 border-emerald-700 text-white shadow"
                                  : "bg-white border-slate-300 text-slate-700"
                              }`}
                            >
                              Normal for Customer
                            </button>
                            <button
                              type="button"
                              onClick={() => setWizardIsUnusualAmt(true)}
                              className={`flex-1 py-2 rounded-lg text-xs font-bold border-2 transition ${
                                wizardIsUnusualAmt
                                  ? "bg-rose-600 border-rose-700 text-white shadow"
                                  : "bg-white border-slate-300 text-slate-700"
                              }`}
                            >
                              ⚠️ 10x Spike vs Usual
                            </button>
                          </div>
                          <p className="text-[10px] text-slate-600 font-medium">Flags sudden deviations from historical account habits</p>
                        </div>

                        <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-xl space-y-1.5 shadow-sm">
                          <label className="block text-[#0F172A] font-bold">5. Account Balance After Transaction</label>
                          <div className="flex gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setWizardBalanceEmptied(false)}
                              className={`flex-1 py-2 rounded-lg text-xs font-bold border-2 transition ${
                                !wizardBalanceEmptied
                                  ? "bg-emerald-600 border-emerald-700 text-white shadow"
                                  : "bg-white border-slate-300 text-slate-700"
                              }`}
                            >
                              Healthy Balance
                            </button>
                            <button
                              type="button"
                              onClick={() => setWizardBalanceEmptied(true)}
                              className={`flex-1 py-2 rounded-lg text-xs font-bold border-2 transition ${
                                wizardBalanceEmptied
                                  ? "bg-rose-600 border-rose-700 text-white shadow"
                                  : "bg-white border-slate-300 text-slate-700"
                              }`}
                            >
                              🚨 Emptied to $0.00
                            </button>
                          </div>
                          <p className="text-[10px] text-slate-600 font-medium">Account takeover fraudsters almost always empty accounts</p>
                        </div>

                        <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-xl space-y-1.5 shadow-sm">
                          <label className="block text-[#0F172A] font-bold">6. Device / Location Consistency</label>
                          <div className="flex gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setWizardLocationRisk(false)}
                              className={`flex-1 py-2 rounded-lg text-xs font-bold border-2 transition ${
                                !wizardLocationRisk
                                  ? "bg-emerald-600 border-emerald-700 text-white shadow"
                                  : "bg-white border-slate-300 text-slate-700"
                              }`}
                            >
                              Home Device
                            </button>
                            <button
                              type="button"
                              onClick={() => setWizardLocationRisk(true)}
                              className={`flex-1 py-2 rounded-lg text-xs font-bold border-2 transition ${
                                wizardLocationRisk
                                  ? "bg-rose-600 border-rose-700 text-white shadow"
                                  : "bg-white border-slate-300 text-slate-700"
                              }`}
                            >
                              ⚠️ Foreign IP / New
                            </button>
                          </div>
                          <p className="text-[10px] text-slate-600 font-medium">Maps to high PCA deviation and heuristic anomaly flags</p>
                        </div>
                      </div>

                      <div className="p-4 bg-amber-100 border-2 border-amber-300 rounded-xl text-xs flex flex-wrap items-center justify-between gap-3 shadow-sm">
                        <div className="text-slate-800 text-[11px] font-medium">
                          Auto-mapped to 16 normalized features:
                          <span className="font-mono text-amber-950 font-bold ml-1.5">
                            Amount Norm: {customFeatures[0]}, Outflow: {customFeatures[9]}, High Risk Ch: {customFeatures[8]}, Anomaly: {customFeatures[12]}
                          </span>
                        </div>
                        <button
                          onClick={handleScoreTransaction}
                          className="px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition shadow-md shadow-amber-500/20"
                        >
                          Score This Transaction
                        </button>
                      </div>
                    </div>
                  )}

                  {inputMode === "advanced" && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-700 font-semibold">Directly modify any of the 16 normalized mathematical features:</span>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => setCustomFeatures(new Array(16).fill(0))}
                            className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs rounded-lg transition font-bold shadow-sm"
                          >
                            Reset to 0
                          </button>
                          <button
                            onClick={() => {
                              setCustomFeatures([3.5, 2.8, 1.0, -0.9, 0.1, 0.2, 0.9, 0.8, 1.0, 1.0, 0.95, 1.0, 0.9, 1.0, 0.8, 0.9]);
                              setPredictionResult(null);
                            }}
                            className="px-3 py-1.5 bg-rose-200 hover:bg-rose-300 border border-rose-400 text-rose-900 text-xs rounded-lg transition font-bold shadow-sm"
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
                          <div key={i} className="p-3 bg-slate-50 border-2 border-slate-200 rounded-xl space-y-1.5 focus-within:border-amber-600 transition shadow-sm">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-[#0F172A] font-sans font-bold truncate">{item.name}</span>
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
                              className="w-full bg-white border-2 border-slate-300 rounded-lg px-2.5 py-1.5 text-amber-950 font-black text-xs focus:outline-none focus:border-amber-600 shadow-inner"
                            />
                          </div>
                        ))}
                      </div>

                      <div className="pt-2 flex justify-end">
                        <button
                          onClick={handleScoreTransaction}
                          className="px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition shadow-md shadow-amber-500/20"
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
              <div className="lg:col-span-1 p-6 bg-gradient-to-br from-rose-100 via-rose-50 to-white border-2 border-rose-300 rounded-xl space-y-4 shadow-sm">
                <div>
                  <h2 className="text-base font-extrabold text-rose-800 flex items-center space-x-2">
                    <ShieldAlert className="h-5 w-5" />
                    <span>Run Attack Simulation</span>
                  </h2>
                  <p className="text-xs text-slate-700 font-medium mt-1">
                    Simulates a Byzantine adversarial bank poisoning model updates, comparing undefended FedAvg against coordinator defense filtering.
                  </p>
                </div>

                <div className="space-y-3.5 text-xs">
                  <div>
                    <label className="block text-[#0F172A] font-bold mb-1">Compromised Node</label>
                    <select
                      value={attackAttacker}
                      onChange={(e) => setAttackAttacker(e.target.value)}
                      className="w-full bg-white border-2 border-slate-300 rounded-lg px-3.5 py-2.5 text-[#0F172A] font-medium focus:outline-none focus:border-rose-600 shadow-sm"
                    >
                      <option value="bank_c">Bank C (Retail Payments)</option>
                      <option value="bank_b">Bank B (Mobile Money)</option>
                      <option value="bank_a">Bank A (Card Swipes)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[#0F172A] font-bold mb-1">Poisoning Attack Vector</label>
                    <select
                      value={attackType}
                      onChange={(e) => setAttackType(e.target.value)}
                      className="w-full bg-white border-2 border-slate-300 rounded-lg px-3.5 py-2.5 text-[#0F172A] font-medium focus:outline-none focus:border-rose-600 shadow-sm"
                    >
                      <option value="scale_poison">100x Scale Weight Poisoning (Exploding Gradients)</option>
                      <option value="label_flip">Label Flipping Attack (Reverses Fraud Labels)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[#0F172A] font-bold mb-1">Defense Aggregation Algorithm</label>
                    <select
                      value={attackDefense}
                      onChange={(e) => setAttackDefense(e.target.value)}
                      className="w-full bg-white border-2 border-slate-300 rounded-lg px-3.5 py-2.5 text-[#0F172A] font-medium focus:outline-none focus:border-amber-600 shadow-sm"
                    >
                      <option value="fedavg">Standard FedAvg + Multi-Layer Anomaly Gate</option>
                      <option value="coordinate_median">Coordinate-wise Median (Byzantine-Robust)</option>
                    </select>
                  </div>

                  <button
                    onClick={handleSimulateAttack}
                    disabled={simulatingAttack}
                    className="w-full py-3.5 bg-rose-700 hover:bg-rose-600 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition shadow-lg shadow-rose-600/30 flex items-center justify-center space-x-2"
                  >
                    <ShieldAlert className="h-4 w-4" />
                    <span>{simulatingAttack ? "Running Simulation..." : "Launch Controlled Attack"}</span>
                  </button>
                </div>
              </div>

              <div className="lg:col-span-2 p-6 bg-gradient-to-br from-emerald-100 via-white to-white border-2 border-emerald-300 rounded-xl space-y-4 shadow-sm">
                <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider">
                  Attack Impact & Defense Screening Result
                </h3>

                {attackResult ? (
                  <div className="space-y-4 text-xs">
                    <div className="p-4 bg-white border-2 border-slate-300 rounded-xl space-y-2.5 shadow-sm">
                      <div className="font-extrabold text-[#0F172A] uppercase">Coordinator Screening Verdicts:</div>
                      {attackResult.screening_results?.map((s: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border-2 border-slate-200 shadow-sm">
                          <span className="font-extrabold text-[#0F172A] uppercase">{s.bank_id}</span>
                          <span className={`px-2.5 py-1 rounded-lg font-mono font-bold text-xs ${
                            s.status === "ACCEPTED" ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
                          }`}>
                            {s.status}
                          </span>
                          <span className="text-slate-700 font-medium text-xs truncate max-w-sm">{s.reason}</span>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-4 font-mono">
                      <div className="p-4 bg-rose-100 border-2 border-rose-300 rounded-xl shadow-sm">
                        <div className="text-[11px] font-sans font-black text-rose-900 uppercase">Ordinary FedAvg (Undefended)</div>
                        <div className="text-2xl font-black text-rose-950 mt-2">{attackResult.ordinary_fedavg_metrics.pr_auc}</div>
                        <div className="text-[11px] text-slate-700 font-semibold mt-1">PR-AUC (Degraded by poisoning)</div>
                      </div>

                      <div className="p-4 bg-emerald-100 border-2 border-emerald-300 rounded-xl shadow-sm">
                        <div className="text-[11px] font-sans font-black text-emerald-900 uppercase">Defended FedAvg (TrustFL)</div>
                        <div className="text-2xl font-black text-emerald-950 mt-2">{attackResult.defended_fedavg_metrics.pr_auc}</div>
                        <div className="text-[11px] text-slate-700 font-semibold mt-1">PR-AUC (Poisoning isolated)</div>
                      </div>
                    </div>

                    <p className="text-[#0F172A] bg-white p-4 rounded-xl border-2 border-slate-300 shadow-sm font-bold">
                      {attackResult.defense_summary}
                    </p>
                  </div>
                ) : (
                  <div className="text-slate-500 font-medium italic p-8 text-center text-xs">
                    Select an attack scenario on the left and click 'Launch Controlled Attack' to see the side-by-side defense verdict and PR-AUC preservation.
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 bg-white border-2 border-slate-300 rounded-xl space-y-4 shadow-sm">
              <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider">
                Compare Models: Standalone Baselines vs Ordinary FedAvg vs Defended FedAvg
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse font-mono">
                  <thead>
                    <tr className="border-b-2 border-slate-300 text-slate-700 font-sans font-extrabold uppercase">
                      <th className="py-3 px-3">Paradigm</th>
                      <th className="py-3 px-3">PR-AUC</th>
                      <th className="py-3 px-3">ROC-AUC</th>
                      <th className="py-3 px-3">F1-Score</th>
                      <th className="py-3 px-3">Poisoning Defense</th>
                      <th className="py-3 px-3">Data Privacy</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {comparison.map((c, i) => (
                      <tr key={i} className="hover:bg-slate-50 font-medium">
                        <td className="py-3.5 px-3 font-sans font-bold text-[#0F172A]">{c.paradigm}</td>
                        <td className="py-3.5 px-3 text-amber-900 font-black">{c.pr_auc.toFixed(4)}</td>
                        <td className="py-3.5 px-3 text-[#0F172A] font-bold">{c.roc_auc.toFixed(4)}</td>
                        <td className="py-3.5 px-3 text-emerald-800 font-black">{c.f1_score.toFixed(4)}</td>
                        <td className="py-3.5 px-3 font-sans">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                            c.defense_capability.includes("100%") ? "bg-emerald-100 text-emerald-900 border border-emerald-300" : "bg-slate-100 text-slate-700"
                          }`}>
                            {c.defense_capability}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 font-sans text-slate-700 font-bold">{c.data_privacy}</td>
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
            <div className="p-6 bg-gradient-to-br from-amber-100 via-yellow-100 to-white border-2 border-amber-300 rounded-xl grid grid-cols-1 md:grid-cols-3 gap-5 shadow-sm">
              <div>
                <span className="text-xs uppercase tracking-wider text-slate-700 font-bold">Contract Address</span>
                <div className="text-sm font-mono text-amber-950 font-extrabold mt-1 break-all select-all">
                  0xF2E246BB76DF876Cef8b38ae84130F4F55De395b
                </div>
                <div className="text-slate-600 font-semibold text-[11px] mt-0.5">Solidity ^0.8.20 (FraudAudit.sol)</div>
              </div>

              <div>
                <span className="text-xs uppercase tracking-wider text-slate-700 font-bold">Coordinator Signer</span>
                <div className="text-sm font-mono text-[#0F172A] font-extrabold mt-1 break-all select-all">
                  0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf
                </div>
                <div className="text-slate-600 font-semibold text-[11px] mt-0.5">Authorized Round Notary</div>
              </div>

              <div>
                <span className="text-xs uppercase tracking-wider text-slate-700 font-bold">Consensus Network</span>
                <div className="text-sm font-extrabold text-emerald-800 mt-1">EVM Local Blockchain</div>
                <div className="text-slate-600 font-semibold text-[11px] mt-0.5">py-evm / Web3.py Integration</div>
              </div>
            </div>

            <div className="p-6 bg-white border-2 border-slate-300 rounded-xl space-y-4 shadow-sm">
              <div>
                <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider flex items-center space-x-2">
                  <FileCheck className="h-4 w-4 text-amber-800" />
                  <span>Verify Model Hash Against Smart Contract Commitment</span>
                </h3>
                <p className="text-xs text-slate-700 font-medium mt-0.5">
                  Calls the on-chain function <code className="text-amber-900 font-mono font-bold">verifyGlobalModel(roundId, modelHash)</code> to cryptographically check if candidate weights are authentic.
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
                  className="w-28 bg-slate-50 border-2 border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-[#0F172A] font-mono font-bold focus:outline-none focus:border-amber-600 shadow-sm"
                />
                <input
                  type="text"
                  value={verifyHashInput}
                  onChange={(e) => setVerifyHashInput(e.target.value)}
                  placeholder="Paste 64-character SHA-256 model hash..."
                  className="flex-1 bg-slate-50 border-2 border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-[#0F172A] font-mono font-bold focus:outline-none focus:border-amber-600 shadow-sm"
                />
                <button
                  onClick={handleVerifyHash}
                  disabled={verifyingHash}
                  className="px-6 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition shadow-md shadow-amber-500/20"
                >
                  {verifyingHash ? "Querying EVM..." : "Verify On-Chain"}
                </button>
              </div>

              {verifyResult && (
                <div className={`p-4 rounded-xl border-2 text-xs flex items-center justify-between shadow-sm ${
                  verifyResult.is_valid_on_chain
                    ? "bg-emerald-100 border-emerald-400 text-emerald-950"
                    : "bg-rose-100 border-rose-400 text-rose-950"
                }`}>
                  <div className="flex items-center space-x-2.5">
                    {verifyResult.is_valid_on_chain ? (
                      <ShieldCheck className="h-5 w-5 text-emerald-700" />
                    ) : (
                      <XCircle className="h-5 w-5 text-rose-700" />
                    )}
                    <span className="font-extrabold text-sm">
                      {verifyResult.is_valid_on_chain
                        ? "AUTHENTIC: Model weights match the cryptographic commitment stored in the smart contract!"
                        : "TAMPER DETECTED: Hash does NOT match the immutable on-chain record for this round!"}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-xs">Round #{verifyResult.round_id}</span>
                </div>
              )}
            </div>

            <div className="p-6 bg-white border-2 border-slate-300 rounded-xl space-y-5 shadow-sm">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b-2 border-slate-200 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-wider flex items-center space-x-2">
                    <Layers className="h-4 w-4 text-amber-800" />
                    <span>On-Chain Cryptographic Blockchain Ledger</span>
                  </h3>
                  <p className="text-xs text-slate-700 font-medium mt-0.5">
                    {chainViewMode === "visual"
                      ? "Graphical node diagram showing blocks chained together by cryptographic hashes on FraudAudit.sol."
                      : "Detailed tabular ledger of all on-chain training rounds and transaction receipts."}
                  </p>
                </div>

                <div className="flex bg-slate-100 p-1 rounded-xl border-2 border-slate-200 text-xs shadow-inner">
                  <button
                    onClick={() => setChainViewMode("visual")}
                    className={`px-3.5 py-1.5 rounded-lg font-bold transition ${
                      chainViewMode === "visual"
                        ? "bg-amber-600 text-white shadow"
                        : "text-slate-700 hover:text-[#0F172A]"
                    }`}
                  >
                    🔗 Graphical Chain
                  </button>
                  <button
                    onClick={() => setChainViewMode("table")}
                    className={`px-3.5 py-1.5 rounded-lg font-bold transition ${
                      chainViewMode === "table"
                        ? "bg-amber-600 text-white shadow"
                        : "text-slate-700 hover:text-[#0F172A]"
                    }`}
                  >
                    📋 Table View
                  </button>
                </div>
              </div>

              {chainViewMode === "visual" && (
                <div className="space-y-6">
                  <div className="p-3.5 bg-emerald-100 border-2 border-emerald-300 rounded-xl flex items-center justify-between text-xs shadow-sm">
                    <div className="flex items-center space-x-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse"></span>
                      <span className="font-extrabold text-emerald-900">Chain State: Cryptographically Linked & Immutable</span>
                    </div>
                    <span className="text-slate-700 font-bold text-[11px]">Click any block below to inspect its on-chain forensics</span>
                  </div>

                  <div className="overflow-x-auto pb-4">
                    <div className="flex items-center space-x-4 min-w-max p-2">
                      <div
                        onClick={() => setSelectedBlockId(0)}
                        className={`w-64 p-5 rounded-xl border-2 transition cursor-pointer select-none shadow-md ${
                          selectedBlockId === 0
                            ? "bg-amber-200 border-amber-600 ring-2 ring-amber-500"
                            : "bg-gradient-to-br from-amber-100 to-white border-amber-300 hover:border-amber-400"
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs mb-2">
                          <span className="px-2.5 py-1 bg-amber-600 text-white rounded-lg font-black font-mono shadow-sm">
                            BLOCK #0
                          </span>
                          <span className="text-slate-700 font-mono font-bold">GENESIS</span>
                        </div>
                        <div className="text-xs font-black text-[#0F172A] mb-1">Architecture Initialization</div>
                        <div className="text-[10px] text-slate-600 font-mono font-semibold break-all truncate">
                          Prev Hash: 0x0000000000000000...
                        </div>
                        <div className="mt-3 pt-2.5 border-t border-amber-200 text-xs text-slate-700 font-semibold flex justify-between">
                          <span>EVM Network Launch</span>
                          <span className="text-emerald-800 font-black">Verified</span>
                        </div>
                      </div>

                      {auditRounds.map((r, idx) => {
                        const blockIndex = idx + 1;
                        const isSelected = selectedBlockId === blockIndex;
                        const hasRejected = r.client_submissions?.some((s: any) => s.decision === "REJECTED");

                        return (
                          <React.Fragment key={`block-node-${r.round_id}-${idx}`}>
                            <div className="flex flex-col items-center text-slate-400 px-1.5">
                              <span className="text-[10px] font-mono text-amber-800 mb-1 font-bold">SHA-256</span>
                              <div className="flex items-center space-x-1">
                                <div className="w-8 h-1 bg-gradient-to-r from-amber-300 to-amber-600 rounded"></div>
                                <ArrowRight className="h-4 w-4 text-amber-700 animate-pulse font-bold" />
                              </div>
                            </div>

                            <div
                              onClick={() => setSelectedBlockId(blockIndex)}
                              className={`w-72 p-5 rounded-xl border-2 transition cursor-pointer select-none shadow-md ${
                                isSelected
                                  ? "bg-amber-200 border-amber-600 ring-2 ring-amber-500"
                                  : hasRejected
                                  ? "bg-amber-100 border-amber-400 hover:border-amber-500"
                                  : "bg-gradient-to-br from-yellow-100 via-white to-white border-amber-300 hover:border-amber-400"
                              }`}
                            >
                              <div className="flex items-center justify-between text-xs mb-2">
                                <span className={`px-2.5 py-1 rounded-lg font-black font-mono shadow-sm ${
                                  hasRejected
                                    ? "bg-amber-600 text-white"
                                    : "bg-amber-600 text-white"
                                }`}>
                                  BLOCK #{r.round_id}
                                </span>
                                <span className="text-slate-800 font-mono text-xs font-extrabold">
                                  {r.defense_strategy?.toUpperCase()}
                                </span>
                              </div>

                              <div className="text-xs font-bold text-[#0F172A] mb-1">
                                Consensus Global Model
                              </div>
                              <div className="p-2 bg-white rounded-lg border-2 border-slate-200 font-mono text-[11px] text-amber-900 font-bold truncate shadow-inner" title={r.resulting_global_model_hash}>
                                {r.resulting_global_model_hash?.slice(0, 20)}...
                              </div>

                              <div className="mt-3 pt-2.5 border-t border-slate-300 space-y-1.5">
                                <span className="text-[11px] text-slate-700 uppercase font-black block">Participants Audited:</span>
                                <div className="flex flex-wrap gap-1.5">
                                  {r.client_submissions?.map((s: any, sIdx: number) => (
                                    <span
                                      key={`sub-${idx}-${sIdx}`}
                                      className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-extrabold flex items-center space-x-1 shadow-sm ${
                                        s.decision === "ACCEPTED"
                                          ? "bg-emerald-600 text-white"
                                          : "bg-rose-600 text-white"
                                      }`}
                                    >
                                      <span>{s.bank_id.toUpperCase()}</span>
                                      <span>{s.decision === "ACCEPTED" ? "✓" : "✗"}</span>
                                    </span>
                                  ))}
                                </div>
                              </div>

                              <div className="mt-3 pt-2.5 border-t border-slate-300 text-xs flex items-center justify-between text-slate-700 font-mono font-bold">
                                <span>{r.blockchain_receipt?.block_number ? `EVM #${r.blockchain_receipt.block_number}` : "Off-Chain"}</span>
                                <span className="text-amber-900 font-black hover:underline">Inspect Details →</span>
                              </div>
                            </div>
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>

                  {selectedBlockId !== null && (
                    <div className="p-6 bg-gradient-to-br from-amber-100 via-white to-white border-2 border-amber-400 rounded-xl space-y-4 shadow-md animate-in fade-in duration-200">
                      <div className="flex items-center justify-between border-b-2 border-slate-200 pb-3">
                        <div className="flex items-center space-x-2">
                          <Lock className="h-5 w-5 text-amber-800" />
                          <h4 className="text-sm font-black text-[#0F172A] uppercase tracking-wider">
                            {selectedBlockId === 0 ? "Genesis Block #0" : `Block #${auditRounds[selectedBlockId - 1]?.round_id ?? selectedBlockId}`} On-Chain Forensic Inspection
                          </h4>
                        </div>
                        <button
                          onClick={() => setSelectedBlockId(null)}
                          className="text-xs font-bold text-slate-700 hover:text-[#0F172A]"
                        >
                          ✕ Close Inspector
                        </button>
                      </div>

                      {selectedBlockId === 0 ? (
                        <div className="text-xs text-slate-800 space-y-2 font-medium">
                          <p><strong>Genesis Block #0:</strong> Deployed <code>FraudAudit.sol</code> contract and established initial random architecture consensus.</p>
                          <div className="font-mono text-xs text-amber-950 font-black">Contract: 0xF2E246BB76DF876Cef8b38ae84130F4F55De395b</div>
                        </div>
                      ) : (
                        (() => {
                          const activeBlock = auditRounds[selectedBlockId - 1];
                          if (!activeBlock) return <div className="text-xs text-slate-600">Block details not found.</div>;

                          return (
                            <div className="space-y-4 text-xs">
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono">
                                <div className="p-4 bg-white rounded-xl border-2 border-slate-300 shadow-sm">
                                  <div className="text-[10px] text-slate-600 font-sans font-bold uppercase">Full Global Model Hash:</div>
                                  <div className="text-amber-950 font-black break-all mt-1">{activeBlock.resulting_global_model_hash}</div>
                                </div>
                                <div className="p-4 bg-white rounded-xl border-2 border-slate-300 shadow-sm">
                                  <div className="text-[10px] text-slate-600 font-sans font-bold uppercase">Blockchain TxHash:</div>
                                  <div className="text-[#0F172A] font-bold break-all mt-1">{activeBlock.blockchain_receipt?.transaction_hash || "Simulated Ledger"}</div>
                                </div>
                                <div className="p-4 bg-white rounded-xl border-2 border-slate-300 shadow-sm">
                                  <div className="text-[10px] text-slate-600 font-sans font-bold uppercase">EVM Block & Gas Used:</div>
                                  <div className="text-emerald-800 font-black mt-1">
                                    Block #{activeBlock.blockchain_receipt?.block_number || "Local"} | Gas: {activeBlock.blockchain_receipt?.gas_used?.toLocaleString() || "N/A"}
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-2 pt-2">
                                <span className="font-black text-[#0F172A] uppercase block text-xs">Bank Update Artifact Submissions:</span>
                                {activeBlock.client_submissions?.map((sub: any, sIdx: number) => (
                                  <div key={`forensic-sub-${sIdx}`} className="p-3 bg-white rounded-xl border-2 border-slate-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs shadow-sm">
                                    <div className="flex items-center space-x-2.5">
                                      <span className="font-black text-[#0F172A] uppercase">{sub.bank_id}:</span>
                                      <span className="font-mono text-amber-950 font-bold truncate max-w-xs">{sub.weights_hash}</span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <span className={`px-2.5 py-1 rounded-lg font-black font-mono text-[11px] shadow-sm ${
                                        sub.decision === "ACCEPTED" ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
                                      }`}>
                                        {sub.decision}
                                      </span>
                                      {sub.reason && <span className="text-slate-700 font-semibold text-xs">({sub.reason})</span>}
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

              {chainViewMode === "table" && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse font-mono">
                    <thead>
                      <tr className="border-b-2 border-slate-300 text-slate-700 font-sans font-extrabold uppercase">
                        <th className="py-3 px-3">Round ID</th>
                        <th className="py-3 px-3">Defense</th>
                        <th className="py-3 px-3">Global Model Hash</th>
                        <th className="py-3 px-3">Bank Submissions & Verdicts</th>
                        <th className="py-3 px-3">On-Chain Transaction Link</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {auditRounds.map((r, i) => (
                        <tr key={`table-round-${r.round_id}-${i}`} className="hover:bg-slate-50 font-medium">
                          <td className="py-3.5 px-3 font-extrabold text-[#0F172A]">#{r.round_id}</td>
                          <td className="py-3.5 px-3 text-amber-950 font-black">{r.defense_strategy?.toUpperCase()}</td>
                          <td className="py-3.5 px-3 text-slate-700 font-bold truncate max-w-xs" title={r.resulting_global_model_hash}>
                            {r.resulting_global_model_hash?.slice(0, 16)}...
                          </td>
                          <td className="py-3.5 px-3 font-sans space-y-1.5">
                            {r.client_submissions?.map((sub: any, sIdx: number) => (
                              <div key={`table-sub-${r.round_id}-${i}-${sIdx}`} className="flex items-center space-x-2 text-xs">
                                <span className="font-extrabold text-[#0F172A]">{sub.bank_id.toUpperCase()}:</span>
                                <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] shadow-sm ${
                                  sub.decision === "ACCEPTED" ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
                                }`}>
                                  {sub.decision}
                                </span>
                                {sub.reason && <span className="text-slate-600 font-medium truncate max-w-xs">({sub.reason})</span>}
                              </div>
                            ))}
                          </td>
                          <td className="py-3.5 px-3 font-sans text-slate-700 font-bold text-xs">
                            {r.blockchain_receipt?.transaction_hash ? (
                              <div>
                                <div className="text-amber-900 font-mono font-black">Tx: {r.blockchain_receipt.transaction_hash.slice(0, 14)}...</div>
                                <div>Block #{r.blockchain_receipt.block_number} | Gas: {r.blockchain_receipt.gas_used?.toLocaleString()}</div>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">Off-Chain Ledger Backup</span>
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
      <footer className="border-t border-slate-300 bg-white px-6 py-4 text-center text-xs text-slate-700 font-semibold shadow-sm">
        CrossBank TrustFL — Blockchain-Audited Federated Learning for Privacy-Preserving Cross-Bank Fraud Detection
      </footer>
    </div>
  );
}