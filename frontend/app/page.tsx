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
  FileCheck,
  Network,
  GitBranch,
  Share2,
  Sliders,
  Compass,
  Sparkles
} from "lucide-react";
import * as api from "./api";

export default function App() {
  const [activeTab, setActiveTab] = useState<"overview" | "training" | "fraud" | "security" | "audit" | "algorithms">("overview");

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

  // Page 6: AI & Heuristic Algorithms State
  const [algoTab, setAlgoTab] = useState<"graph" | "heuristics" | "annealing" | "bayesian">("graph");
  const [graphTopology, setGraphTopology] = useState<any>(null);
  const [bfsStartNode, setBfsStartNode] = useState("A_CARD_901");
  const [bfsMaxDepth, setBfsMaxDepth] = useState(3);
  const [bfsResult, setBfsResult] = useState<any>(null);
  const [loadingBFS, setLoadingBFS] = useState(false);

  const [dfsResult, setDfsResult] = useState<any>(null);
  const [loadingDFS, setLoadingDFS] = useState(false);

  const [astarStartNode, setAstarStartNode] = useState("A_CARD_901");
  const [astarEndNode, setAstarEndNode] = useState("C_RETL_302");
  const [astarResult, setAstarResult] = useState<any>(null);
  const [loadingAStar, setLoadingAStar] = useState(false);

  const [benfordResult, setBenfordResult] = useState<any>(null);
  const [benfordSynthetic, setBenfordSynthetic] = useState(false);
  const [loadingBenford, setLoadingBenford] = useState(false);

  const [smurfingResult, setSmurfingResult] = useState<any>(null);
  const [smurfingSampleType, setSmurfingSampleType] = useState("smurfed");
  const [loadingSmurfing, setLoadingSmurfing] = useState(false);

  const [saResult, setSaResult] = useState<any>(null);
  const [loadingSA, setLoadingSA] = useState(false);

  // Bayesian Network State
  const [bayesianEvidence, setBayesianEvidence] = useState<Record<string, string>>({
    TimeRisk: "ODD_HOURS",
    ChannelRisk: "HIGH_RISK"
  });
  const [bayesianResult, setBayesianResult] = useState<any>(null);
  const [loadingBayesian, setLoadingBayesian] = useState(false);

  useEffect(() => {
    loadInitialData();
    const interval = setInterval(() => {
      refreshLiveStatus();
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const loadInitialData = async () => {
    try {
      const [st, bk, gm, ar, comp, smp, topo] = await Promise.all([
        api.getSystemStatus(),
        api.getRegisteredBanks(),
        api.getGlobalModel(),
        api.getAuditRounds(),
        api.getModelComparison(),
        api.getFraudSamples(),
        api.getGraphTopology().catch(() => null)
      ]);
      setStatus(st);
      setBanks(bk.banks || []);
      setGlobalModel(gm);
      setAuditRounds(ar.rounds || []);
      setComparison(comp.benchmarks || []);
      setSamples(smp.samples || []);
      if (topo) setGraphTopology(topo);
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

  // Algorithm & Heuristic Handlers
  const handleFetchTopology = async () => {
    try {
      const topo = await api.getGraphTopology();
      setGraphTopology(topo);
    } catch (e: any) {
      console.error("Failed to load topology", e);
    }
  };

  const handleRunBFS = async () => {
    setLoadingBFS(true);
    setBfsResult(null);
    try {
      const res = await api.runBFSMuleTrace(bfsStartNode, bfsMaxDepth);
      setBfsResult(res);
    } catch (err: any) {
      alert("BFS trace failed: " + err.message);
    } finally {
      setLoadingBFS(false);
    }
  };

  const handleRunDFS = async () => {
    setLoadingDFS(true);
    setDfsResult(null);
    try {
      const res = await api.runDFSWashCycles(6);
      setDfsResult(res);
    } catch (err: any) {
      alert("DFS cycle detection failed: " + err.message);
    } finally {
      setLoadingDFS(false);
    }
  };

  const handleRunAStar = async () => {
    setLoadingAStar(true);
    setAstarResult(null);
    try {
      const res = await api.runAStarPath(astarStartNode, astarEndNode);
      setAstarResult(res);
    } catch (err: any) {
      alert("A* Path search failed: " + err.message);
    } finally {
      setLoadingAStar(false);
    }
  };

  const handleRunBenford = async (useSynthetic: boolean) => {
    setLoadingBenford(true);
    setBenfordResult(null);
    setBenfordSynthetic(useSynthetic);
    try {
      const res = await api.runBenfordHeuristic(useSynthetic);
      setBenfordResult(res);
    } catch (err: any) {
      alert("Benford heuristic failed: " + err.message);
    } finally {
      setLoadingBenford(false);
    }
  };

  const handleRunSmurfing = async (type: string) => {
    setLoadingSmurfing(true);
    setSmurfingResult(null);
    setSmurfingSampleType(type);
    try {
      const res = await api.runSmurfingHeuristic(type, 10000.0);
      setSmurfingResult(res);
    } catch (err: any) {
      alert("Smurfing heuristic failed: " + err.message);
    } finally {
      setLoadingSmurfing(false);
    }
  };

  const handleRunSA = async () => {
    setLoadingSA(true);
    setSaResult(null);
    try {
      const res = await api.runClientWeightsSA(100.0, 0.92, 150);
      setSaResult(res);
    } catch (err: any) {
      alert("Simulated Annealing failed: " + err.message);
    } finally {
      setLoadingSA(false);
    }
  };

  const handleRunBayesianQuery = async (customEvidence?: Record<string, string>) => {
    setLoadingBayesian(true);
    const targetEvidence = customEvidence !== undefined ? customEvidence : bayesianEvidence;
    try {
      const res = await api.runBayesianQuery(targetEvidence);
      setBayesianResult(res);
    } catch (err: any) {
      alert("Bayesian query failed: " + err.message);
    } finally {
      setLoadingBayesian(false);
    }
  };

  const toggleEvidence = (varName: string, stateValue: string) => {
    const updated = { ...bayesianEvidence };
    if (updated[varName] === stateValue) {
      delete updated[varName];
    } else {
      updated[varName] = stateValue;
    }
    setBayesianEvidence(updated);
    handleRunBayesianQuery(updated);
  };



  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Navigation Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-50 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-slate-900 text-white rounded-lg">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-semibold tracking-tight text-slate-900">CrossBank TrustFL</h1>
              <span className="px-2 py-0.5 text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200 rounded">
                Live Prototype
              </span>
            </div>
            <p className="text-xs text-slate-500">Privacy-Preserving Federated Learning & Blockchain Audit</p>
          </div>
        </div>

        {/* Backend & Chain Status Badges */}
        <div className="flex items-center space-x-2.5">
          <div className="flex items-center space-x-2 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-1 text-xs font-medium text-emerald-800">
            <span className={`w-2 h-2 rounded-full ${backendOnline ? "bg-emerald-600" : "bg-rose-600"}`}></span>
            <span>Backend: {backendOnline ? "Online (:8000)" : "Connecting..."}</span>
          </div>

          <div className="flex items-center space-x-1.5 bg-slate-100 border border-slate-200 rounded-md px-3 py-1 text-xs font-medium text-slate-700">
            <Lock className="w-3.5 h-3.5 text-slate-500" />
            <span>Solidity EVM On-Chain</span>
          </div>

          <button
            onClick={() => { refreshLiveStatus(); loadInitialData(); }}
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-md transition"
            title="Refresh Live Data"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Main Tabs Navigation */}
      <div className="border-b border-slate-200 bg-white px-6 flex space-x-1">
        {[
          { id: "overview", label: "Overview", icon: Activity },
          { id: "training", label: "Federated Learning", icon: Cpu },
          { id: "fraud", label: "Fraud Explorer", icon: Search },
          { id: "security", label: "Trust & Security", icon: ShieldAlert },
          { id: "audit", label: "Blockchain Audit", icon: Layers },
          { id: "algorithms", label: "Algorithms & Heuristics", icon: Network }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 px-4 py-3 text-xs font-medium border-b-2 transition ${
                isActive
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
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

        {/* PAGE 1 — OVERVIEW DASHBOARD */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Minimalist Architecture Banner */}
            <div className="p-4 bg-white border border-slate-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-700 shadow-xs">
              <span className="flex items-center space-x-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span><strong>Federated Architecture:</strong> 3 banks train local models on private datasets and share only serialized weight gradients securely via EVM smart contracts.</span>
              </span>
              <span className="px-2.5 py-1 bg-slate-100 text-slate-800 border border-slate-200 rounded font-mono text-[11px] font-medium shrink-0">
                100% Privacy Preserved
              </span>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-5 bg-white border border-slate-200 rounded-lg shadow-xs">
                <div className="flex items-center justify-between text-slate-500 text-xs font-medium uppercase tracking-wider">
                  <span>Current Round</span>
                  <Activity className="h-4 w-4 text-slate-400" />
                </div>
                <div className="mt-2 text-2xl font-semibold text-slate-900">Round {status?.current_round ?? 0}</div>
                <div className="mt-2 text-xs text-emerald-700 font-medium">Consensus converged</div>
              </div>

              <div className="p-5 bg-white border border-slate-200 rounded-lg shadow-xs">
                <div className="flex items-center justify-between text-slate-500 text-xs font-medium uppercase tracking-wider">
                  <span>Participating Banks</span>
                  <Database className="h-4 w-4 text-slate-400" />
                </div>
                <div className="mt-2 text-2xl font-semibold text-slate-900">3 Nodes</div>
                <p className="mt-1 text-xs text-slate-500">Bank A, Bank B, Bank C</p>
              </div>

              <div className="p-5 bg-white border border-slate-200 rounded-lg shadow-xs">
                <div className="flex items-center justify-between text-slate-500 text-xs font-medium uppercase tracking-wider">
                  <span>Audited Rounds</span>
                  <Layers className="h-4 w-4 text-slate-400" />
                </div>
                <div className="mt-2 text-2xl font-semibold text-slate-900">{status?.total_audited_rounds ?? 0} Committed</div>
                <p className="mt-1 text-xs text-slate-500">Stored on FraudAudit.sol</p>
              </div>

              <div className="p-5 bg-white border border-slate-200 rounded-lg shadow-xs">
                <div className="flex items-center justify-between text-slate-500 text-xs font-medium uppercase tracking-wider">
                  <span>Global Architecture</span>
                  <Cpu className="h-4 w-4 text-slate-400" />
                </div>
                <div className="mt-2 text-2xl font-semibold text-slate-900">3,393 Weights</div>
                <p className="mt-1 text-xs text-slate-500">16-D Standardized MLP</p>
              </div>
            </div>

            {/* Global Model Fingerprint Card */}
            <div className="p-5 bg-white border border-slate-200 rounded-lg space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Active Global Model Fingerprint (SHA-256)</span>
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium rounded text-xs">
                  Verified On-Chain
                </span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-md font-mono text-xs text-slate-800 break-all select-all">
                {status?.active_global_model_hash ?? "Loading live model hash..."}
              </div>
            </div>

            {/* Participating Bank Cards */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-slate-900">Participating Bank Clients</h2>
                <span className="text-xs text-slate-600 font-medium">Raw transaction datasets remain strictly private</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {banks.map((b) => (
                  <div key={b.id} className="p-5 bg-white border border-slate-200 rounded-lg space-y-3 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900 text-sm">{b.name}</span>
                      <span className="px-2 py-0.5 text-xs bg-slate-100 text-slate-700 border border-slate-200 rounded font-medium">
                        {b.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">{b.dataset_source}</div>

                    <div className="space-y-1.5 text-xs pt-3 border-t border-slate-100 font-mono">
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-sans">Private Records:</span>
                        <span className="text-slate-900 font-semibold">{b.records.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-sans">Fraud Cases:</span>
                        <span className="text-rose-600 font-semibold">{b.fraud_count.toLocaleString()} ({b.fraud_rate_pct}%)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-sans">Transmitted Data:</span>
                        <span className="text-slate-800 font-semibold">Model Weights Only</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* PAGE 2 — FEDERATED LEARNING */}
        {activeTab === "training" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Control Panel */}
            <div className="lg:col-span-1 p-5 bg-white border border-slate-200 rounded-lg space-y-4 shadow-xs">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 flex items-center space-x-2">
                  <Play className="h-4 w-4 text-slate-700" />
                  <span>Start Training Round</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Triggers local client training across all 3 banks, runs coordinator defense screening, and updates the global model on-chain.
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Round ID to Train</label>
                  <input
                    type="number"
                    value={isNaN(trainRoundId) ? "" : trainRoundId}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      setTrainRoundId(isNaN(v) ? 0 : v);
                    }}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-900 font-mono font-medium focus:outline-none focus:border-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Defense & Aggregation Strategy</label>
                  <select
                    value={trainDefense}
                    onChange={(e) => setTrainDefense(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-900 font-medium focus:outline-none focus:border-slate-900"
                  >
                    <option value="fedavg">Sample-Weighted FedAvg (Standard)</option>
                    <option value="coordinate_median">Coordinate-wise Median (Byzantine-Robust)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Local Training Epochs</label>
                  <select
                    value={trainEpochs}
                    onChange={(e) => setTrainEpochs(parseInt(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-900 font-medium focus:outline-none focus:border-slate-900"
                  >
                    <option value={1}>1 Local Epoch</option>
                    <option value={2}>2 Local Epochs</option>
                  </select>
                </div>

                <button
                  onClick={handleStartTraining}
                  disabled={loading || trainingStatus?.status === "RUNNING"}
                  className={`w-full py-2.5 rounded-md font-medium text-xs transition flex items-center justify-center space-x-1.5 ${
                    trainingStatus?.status === "RUNNING"
                      ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                      : "bg-slate-900 hover:bg-slate-800 text-white"
                  }`}
                >
                  <Play className="h-3.5 w-3.5" />
                  <span>{trainingStatus?.status === "RUNNING" ? "Round In Progress..." : "Execute Training Round"}</span>
                </button>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-md text-xs space-y-1 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">Coordinator Status:</span>
                  <span className="text-slate-900 font-medium">{trainingStatus?.status ?? "IDLE"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">Progress:</span>
                  <span className="text-slate-900 font-medium">{trainingStatus?.progress_percent ?? 0}%</span>
                </div>
              </div>
            </div>

            {/* Live Progress & Log Stream */}
            <div className="lg:col-span-2 space-y-4">
              <div className="p-5 bg-white border border-slate-200 rounded-lg space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">Round Progression</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{trainingStatus?.current_step ?? "Idle — Ready for federation round"}</p>
                  </div>
                  <span className="px-2.5 py-1 text-xs rounded font-medium bg-slate-100 text-slate-800 border border-slate-200">
                    {trainingStatus?.progress_percent ?? 0}% Completed
                  </span>
                </div>

                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-slate-900 h-full transition-all duration-300"
                    style={{ width: `${trainingStatus?.progress_percent ?? 0}%` }}
                  ></div>
                </div>

                <div className="grid grid-cols-4 text-center text-[11px] text-slate-500 pt-1 font-medium">
                  <div>1. Local Training</div>
                  <div>2. Defense Screen</div>
                  <div>3. Parameter Aggregation</div>
                  <div>4. Smart Contract Commit</div>
                </div>
              </div>

              {/* Terminal Logs */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg font-mono text-xs text-slate-300 space-y-2">
                <div className="flex items-center space-x-2 text-slate-400 pb-2 border-b border-slate-800">
                  <Terminal className="h-4 w-4" />
                  <span className="font-medium text-slate-200">Execution Telemetry & Defense Log</span>
                </div>
                <div className="h-64 overflow-y-auto space-y-1.5 pt-2 text-slate-300">
                  {trainingStatus?.logs && trainingStatus.logs.length > 0 ? (
                    trainingStatus.logs.map((log: string, idx: number) => (
                      <div key={idx} className="leading-relaxed">
                        <span className="text-slate-500 font-medium">[{idx + 1}]</span> {log}
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-500 italic">No training active. Click 'Execute Training Round' to trigger.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PAGE 3 — FRAUD EXPLORER */}
        {activeTab === "fraud" && (
          <div className="space-y-6">
            <div className="p-5 bg-white border border-slate-200 rounded-lg space-y-4 shadow-xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 flex items-center space-x-2">
                    <BarChart3 className="h-4 w-4 text-slate-700" />
                    <span>Evaluate Global Model on Labelled Test Split</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Evaluates the collaborative Global MLP across held-out test splits from Bank A, Bank B, or Bank C.
                  </p>
                </div>

                <div className="flex items-center space-x-2.5">
                  <select
                    value={chosenDatasetKey}
                    onChange={(e) => setChosenDatasetKey(e.target.value)}
                    className="bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 font-medium focus:outline-none focus:border-slate-900"
                  >
                    <option value="bank_a">Bank A (Credit Card Test Split)</option>
                    <option value="bank_b">Bank B (PaySim Mobile Test Split)</option>
                    <option value="bank_c">Bank C (BankSim Retail Test Split)</option>
                  </select>

                  <button
                    onClick={handleEvaluateDataset}
                    disabled={evaluatingDataset}
                    className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded-md transition"
                  >
                    {evaluatingDataset ? "Evaluating on Disk..." : "Run Evaluation"}
                  </button>
                </div>
              </div>

              {datasetEvalResult && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-900">{datasetEvalResult.dataset_name}</span>
                    <span className="font-mono text-slate-500">
                      Evaluated {datasetEvalResult.evaluated_samples.toLocaleString()} records ({datasetEvalResult.actual_frauds_in_test} frauds)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 font-mono">
                    <div className="p-3 bg-white border border-slate-200 rounded-md text-center">
                      <div className="text-[10px] text-slate-500 font-sans uppercase font-medium">PR-AUC</div>
                      <div className="text-lg font-semibold text-slate-900 mt-0.5">{datasetEvalResult.pr_auc}</div>
                    </div>
                    <div className="p-3 bg-white border border-slate-200 rounded-md text-center">
                      <div className="text-[10px] text-slate-500 font-sans uppercase font-medium">ROC-AUC</div>
                      <div className="text-lg font-semibold text-slate-900 mt-0.5">{datasetEvalResult.roc_auc}</div>
                    </div>
                    <div className="p-3 bg-white border border-slate-200 rounded-md text-center">
                      <div className="text-[10px] text-slate-500 font-sans uppercase font-medium">F1-Score</div>
                      <div className="text-lg font-semibold text-slate-900 mt-0.5">{datasetEvalResult.f1_score}</div>
                    </div>
                    <div className="p-3 bg-white border border-slate-200 rounded-md text-center">
                      <div className="text-[10px] text-slate-500 font-sans uppercase font-medium">Precision</div>
                      <div className="text-lg font-semibold text-slate-900 mt-0.5">{datasetEvalResult.precision}</div>
                    </div>
                    <div className="p-3 bg-white border border-slate-200 rounded-md text-center">
                      <div className="text-[10px] text-slate-500 font-sans uppercase font-medium">Recall</div>
                      <div className="text-lg font-semibold text-slate-900 mt-0.5">{datasetEvalResult.recall}</div>
                    </div>
                  </div>

                  {datasetEvalResult.confusion_matrix && (
                    <div className="text-xs text-slate-500 font-mono flex items-center justify-between pt-2 border-t border-slate-200">
                      <span>Confusion Matrix: TN={datasetEvalResult.confusion_matrix[0][0]}, FP={datasetEvalResult.confusion_matrix[0][1]}, FN={datasetEvalResult.confusion_matrix[1][0]}, TP={datasetEvalResult.confusion_matrix[1][1]}</span>
                      <span className="text-emerald-700 font-sans font-medium">Live Model Evaluation</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Preset Sample Picker */}
              <div className="lg:col-span-1 p-5 bg-white border border-slate-200 rounded-lg space-y-4 shadow-xs">
                <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider flex items-center space-x-2">
                  <Search className="h-4 w-4 text-slate-600" />
                  <span>Preset Test Transactions</span>
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
                      className={`w-full text-left p-3 rounded-md border text-xs transition ${
                        selectedSample?.id === s.id
                          ? "bg-slate-100 border-slate-900 text-slate-900 font-medium"
                          : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-slate-900">{s.bank}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                          s.ground_truth === "Fraud" ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        }`}>
                          {s.ground_truth}
                        </span>
                      </div>
                      <p className="text-slate-500 text-[11px] leading-tight">{s.description}</p>
                    </button>
                  ))}
                </div>

                <div className="pt-3 border-t border-slate-200 text-xs">
                  <div className="flex justify-between text-slate-700 font-medium mb-1">
                    <span>Decision Threshold:</span>
                    <span className="font-mono text-slate-900 font-semibold">{threshold.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="0.9"
                    step="0.05"
                    value={threshold}
                    onChange={(e) => setThreshold(parseFloat(e.target.value))}
                    className="w-full accent-slate-900 cursor-pointer"
                  />
                </div>

                <button
                  onClick={handleScoreTransaction}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded-md transition"
                >
                  Score Selected Transaction
                </button>
              </div>

              {/* Simulator & Results */}
              <div className="lg:col-span-2 space-y-4">
                {predictionResult && (
                  <div className={`p-4 border rounded-lg flex items-center justify-between ${
                    predictionResult.is_fraud
                      ? "bg-rose-50 border-rose-200 text-rose-900"
                      : "bg-emerald-50 border-emerald-200 text-emerald-900"
                  }`}>
                    <div>
                      <div className="flex items-center space-x-2">
                        {predictionResult.is_fraud ? (
                          <AlertTriangle className="h-5 w-5 text-rose-600" />
                        ) : (
                          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        )}
                        <span className="text-base font-semibold">
                          {predictionResult.is_fraud ? "Fraud Alert Triggered" : "Transaction Approved"}
                        </span>
                        <span className={`px-2 py-0.5 text-xs font-medium border rounded ${
                          predictionResult.is_fraud ? "bg-rose-100 text-rose-800 border-rose-300" : "bg-emerald-100 text-emerald-800 border-emerald-300"
                        }`}>
                          {predictionResult.risk_tier} Risk
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1 max-w-lg">{predictionResult.explanation}</p>
                    </div>

                    <div className="text-right">
                      <div className="text-[11px] uppercase text-slate-500 font-medium">Fraud Probability</div>
                      <div className="text-2xl font-bold font-mono text-slate-900">
                        {(predictionResult.fraud_probability * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                )}

                <div className="p-5 bg-white border border-slate-200 rounded-lg space-y-4 shadow-xs">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-900">
                        Transaction Feature Simulator
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {inputMode === "wizard"
                          ? "Answer banking questions; the system maps them into 16 normalized feature inputs."
                          : "Directly adjust the 16 normalized feature values."}
                      </p>
                    </div>

                    <div className="flex bg-slate-100 p-0.5 rounded-md border border-slate-200 text-xs">
                      <button
                        onClick={() => setInputMode("wizard")}
                        className={`px-3 py-1 rounded text-xs font-medium transition ${
                          inputMode === "wizard" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        Guided Form
                      </button>
                      <button
                        onClick={() => setInputMode("advanced")}
                        className={`px-3 py-1 rounded text-xs font-medium transition ${
                          inputMode === "advanced" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        Direct 16-D
                      </button>
                    </div>
                  </div>

                  {inputMode === "wizard" && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-md space-y-1.5">
                          <label className="block text-slate-800 font-medium">1. Transaction Amount ($ USD)</label>
                          <input
                            type="number"
                            min="1"
                            value={wizardAmount}
                            onChange={(e) => setWizardAmount(Math.max(1, parseFloat(e.target.value) || 0))}
                            className="w-full bg-white border border-slate-300 rounded px-3 py-1.5 text-slate-900 font-mono font-medium text-xs focus:outline-none focus:border-slate-900"
                          />
                          <p className="text-[10px] text-slate-500">e.g. $25 for POS retail, $2,500 for wire transfer</p>
                        </div>

                        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-md space-y-1.5">
                          <label className="block text-slate-800 font-medium">2. Transaction Type / Channel</label>
                          <select
                            value={wizardChannel}
                            onChange={(e) => setWizardChannel(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded px-3 py-1.5 text-slate-900 font-medium text-xs focus:outline-none focus:border-slate-900"
                          >
                            <option value="card_swipe">In-Store Card Swipe (Bank A)</option>
                            <option value="online_pay">Online Merchant Payment (Bank C)</option>
                            <option value="transfer">Mobile Money Wire Transfer (Bank B)</option>
                            <option value="cashout">Instant Cash-Out / ATM (Bank B)</option>
                            <option value="crypto">Luxury Merchant / Jewelry (Bank C)</option>
                          </select>
                          <p className="text-[10px] text-slate-500">Instant wires and cash-outs carry higher structural risk</p>
                        </div>

                        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-md space-y-1.5">
                          <label className="block text-slate-800 font-medium">3. Time of Transaction</label>
                          <select
                            value={wizardTime}
                            onChange={(e) => setWizardTime(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded px-3 py-1.5 text-slate-900 font-medium text-xs focus:outline-none focus:border-slate-900"
                          >
                            <option value="morning">Morning (9:00 AM — Business Hours)</option>
                            <option value="afternoon">Afternoon (2:00 PM — Standard Day)</option>
                            <option value="evening">Late Evening (11:00 PM)</option>
                            <option value="midnight">Off-Hours (3:00 AM — Anomaly Window)</option>
                          </select>
                          <p className="text-[10px] text-slate-500">Night transactions trigger temporal anomaly signals</p>
                        </div>

                        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-md space-y-1.5">
                          <label className="block text-slate-800 font-medium">4. Spending Deviation</label>
                          <div className="flex gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setWizardIsUnusualAmt(false)}
                              className={`flex-1 py-1.5 rounded text-xs font-medium border transition ${
                                !wizardIsUnusualAmt ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-300 text-slate-700"
                              }`}
                            >
                              Typical Volume
                            </button>
                            <button
                              type="button"
                              onClick={() => setWizardIsUnusualAmt(true)}
                              className={`flex-1 py-1.5 rounded text-xs font-medium border transition ${
                                wizardIsUnusualAmt ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-300 text-slate-700"
                              }`}
                            >
                              Spike vs History
                            </button>
                          </div>
                          <p className="text-[10px] text-slate-500">Flags deviations from historical account activity</p>
                        </div>

                        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-md space-y-1.5">
                          <label className="block text-slate-800 font-medium">5. Balance State After Transfer</label>
                          <div className="flex gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setWizardBalanceEmptied(false)}
                              className={`flex-1 py-1.5 rounded text-xs font-medium border transition ${
                                !wizardBalanceEmptied ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-300 text-slate-700"
                              }`}
                            >
                              Balance Retained
                            </button>
                            <button
                              type="button"
                              onClick={() => setWizardBalanceEmptied(true)}
                              className={`flex-1 py-1.5 rounded text-xs font-medium border transition ${
                                wizardBalanceEmptied ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-300 text-slate-700"
                              }`}
                            >
                              Drained to Zero
                            </button>
                          </div>
                          <p className="text-[10px] text-slate-500">Account takeovers frequently drain balances completely</p>
                        </div>

                        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-md space-y-1.5">
                          <label className="block text-slate-800 font-medium">6. Device & Location Consistency</label>
                          <div className="flex gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setWizardLocationRisk(false)}
                              className={`flex-1 py-1.5 rounded text-xs font-medium border transition ${
                                !wizardLocationRisk ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-300 text-slate-700"
                              }`}
                            >
                              Recognized Device
                            </button>
                            <button
                              type="button"
                              onClick={() => setWizardLocationRisk(true)}
                              className={`flex-1 py-1.5 rounded text-xs font-medium border transition ${
                                wizardLocationRisk ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-300 text-slate-700"
                              }`}
                            >
                              Foreign / Unrecognized
                            </button>
                          </div>
                          <p className="text-[10px] text-slate-500">Increases heuristic risk and outlier deviation scores</p>
                        </div>
                      </div>

                      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-md text-xs flex flex-wrap items-center justify-between gap-3">
                        <div className="text-slate-600 text-[11px]">
                          Mapped to 16-D normalized vector:
                          <span className="font-mono text-slate-900 font-medium ml-1.5">
                            amt_norm={customFeatures[0]}, outflow={customFeatures[9]}, risk_ch={customFeatures[8]}, anomaly={customFeatures[12]}
                          </span>
                        </div>
                        <button
                          onClick={handleScoreTransaction}
                          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded-md transition"
                        >
                          Score Transaction
                        </button>
                      </div>
                    </div>
                  )}

                  {inputMode === "advanced" && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-600">Directly modify any of the 16 normalized feature parameters:</span>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => setCustomFeatures(new Array(16).fill(0))}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs rounded border border-slate-200 font-medium"
                          >
                            Reset to 0
                          </button>
                          <button
                            onClick={() => {
                              setCustomFeatures([3.5, 2.8, 1.0, -0.9, 0.1, 0.2, 0.9, 0.8, 1.0, 1.0, 0.95, 1.0, 0.9, 1.0, 0.8, 0.9]);
                              setPredictionResult(null);
                            }}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs rounded border border-rose-200 font-medium"
                          >
                            Fill High Risk
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-xs">
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
                          <div key={i} className="p-2.5 bg-slate-50 border border-slate-200 rounded space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-slate-900 font-sans font-medium truncate">{item.name}</span>
                              <span className="text-[9px] text-slate-400 font-sans">{item.hint}</span>
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
                              className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-900 font-medium text-xs focus:outline-none focus:border-slate-900"
                            />
                          </div>
                        ))}
                      </div>

                      <div className="pt-2 flex justify-end">
                        <button
                          onClick={handleScoreTransaction}
                          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded-md transition"
                        >
                          Score Custom Feature Vector
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PAGE 4 — TRUST & SECURITY */}
        {activeTab === "security" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1 p-5 bg-white border border-slate-200 rounded-lg space-y-4 shadow-xs">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 flex items-center space-x-2">
                    <ShieldAlert className="h-4 w-4 text-slate-700" />
                    <span>Simulate Adversarial Attack</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Simulates a Byzantine client injecting poisoned model updates, comparing standard FedAvg against TrustFL coordinator defense filtering.
                  </p>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Compromised Client Node</label>
                    <select
                      value={attackAttacker}
                      onChange={(e) => setAttackAttacker(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-900 font-medium focus:outline-none focus:border-slate-900"
                    >
                      <option value="bank_c">Bank C (Retail Payments)</option>
                      <option value="bank_b">Bank B (Mobile Money)</option>
                      <option value="bank_a">Bank A (Card Swipes)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Poisoning Attack Vector</label>
                    <select
                      value={attackType}
                      onChange={(e) => setAttackType(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-900 font-medium focus:outline-none focus:border-slate-900"
                    >
                      <option value="scale_poison">100x Scale Weight Poisoning (Exploding Gradients)</option>
                      <option value="label_flip">Label Flipping Attack (Reverses Fraud Labels)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Defense Aggregation Algorithm</label>
                    <select
                      value={attackDefense}
                      onChange={(e) => setAttackDefense(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-900 font-medium focus:outline-none focus:border-slate-900"
                    >
                      <option value="fedavg">Standard FedAvg + Multi-Layer Anomaly Gate</option>
                      <option value="coordinate_median">Coordinate-wise Median (Byzantine-Robust)</option>
                    </select>
                  </div>

                  <button
                    onClick={handleSimulateAttack}
                    disabled={simulatingAttack}
                    className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs rounded-md transition flex items-center justify-center space-x-1.5"
                  >
                    <ShieldAlert className="h-4 w-4" />
                    <span>{simulatingAttack ? "Running Simulation..." : "Simulate Attack"}</span>
                  </button>
                </div>
              </div>

              <div className="lg:col-span-2 p-5 bg-white border border-slate-200 rounded-lg space-y-4 shadow-xs">
                <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                  Attack Impact & Defense Screening Result
                </h3>

                {attackResult ? (
                  <div className="space-y-4 text-xs">
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                      <div className="font-semibold text-slate-900 text-xs">Coordinator Screening Verdicts:</div>
                      {attackResult.screening_results?.map((s: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-2.5 bg-white rounded border border-slate-200">
                          <span className="font-semibold text-slate-900 uppercase">{s.bank_id}</span>
                          <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium ${
                            s.status === "ACCEPTED" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}>
                            {s.status}
                          </span>
                          <span className="text-slate-600 text-xs truncate max-w-sm">{s.reason}</span>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-4 font-mono">
                      <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg">
                        <div className="text-[11px] font-sans font-semibold text-rose-800">Undefended FedAvg</div>
                        <div className="text-2xl font-bold text-rose-900 mt-1">{attackResult.ordinary_fedavg_metrics.pr_auc}</div>
                        <div className="text-[11px] text-slate-500 font-sans mt-0.5">PR-AUC degraded by poisoning</div>
                      </div>

                      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                        <div className="text-[11px] font-sans font-semibold text-emerald-800">Defended FedAvg (TrustFL)</div>
                        <div className="text-2xl font-bold text-emerald-900 mt-1">{attackResult.defended_fedavg_metrics.pr_auc}</div>
                        <div className="text-[11px] text-slate-500 font-sans mt-0.5">PR-AUC preserved via anomaly filtering</div>
                      </div>
                    </div>

                    <p className="text-slate-700 bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-xs font-medium">
                      {attackResult.defense_summary}
                    </p>
                  </div>
                ) : (
                  <div className="text-slate-400 italic p-8 text-center text-xs">
                    Select an attack scenario on the left and click 'Simulate Attack' to inspect defense screening and PR-AUC preservation.
                  </div>
                )}
              </div>
            </div>

            <div className="p-5 bg-white border border-slate-200 rounded-lg space-y-3 shadow-xs">
              <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                Model Comparison: Standalone Baselines vs Ordinary FedAvg vs Defended FedAvg
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse font-mono">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-sans font-medium uppercase text-[11px]">
                      <th className="py-2.5 px-3">Paradigm</th>
                      <th className="py-2.5 px-3">PR-AUC</th>
                      <th className="py-2.5 px-3">ROC-AUC</th>
                      <th className="py-2.5 px-3">F1-Score</th>
                      <th className="py-2.5 px-3">Poisoning Defense</th>
                      <th className="py-2.5 px-3">Data Privacy</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {comparison.map((c, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-sans font-medium text-slate-900">{c.paradigm}</td>
                        <td className="py-2.5 px-3 text-slate-900 font-semibold">{c.pr_auc.toFixed(4)}</td>
                        <td className="py-2.5 px-3 text-slate-700">{c.roc_auc.toFixed(4)}</td>
                        <td className="py-2.5 px-3 text-slate-900 font-semibold">{c.f1_score.toFixed(4)}</td>
                        <td className="py-2.5 px-3 font-sans">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                            c.defense_capability.includes("100%") ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-600"
                          }`}>
                            {c.defense_capability}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-sans text-slate-600">{c.data_privacy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* PAGE 5 — BLOCKCHAIN AUDIT */}
        {activeTab === "audit" && (
          <div className="space-y-6">
            <div className="p-5 bg-white border border-slate-200 rounded-lg grid grid-cols-1 md:grid-cols-3 gap-4 shadow-xs">
              <div>
                <span className="text-[11px] uppercase tracking-wider text-slate-500 font-medium">Smart Contract</span>
                <div className="text-xs font-mono text-slate-900 font-semibold mt-1 break-all select-all">
                  0xF2E246BB76DF876Cef8b38ae84130F4F55De395b
                </div>
                <div className="text-slate-500 text-[11px] mt-0.5">Solidity ^0.8.20 (FraudAudit.sol)</div>
              </div>

              <div>
                <span className="text-[11px] uppercase tracking-wider text-slate-500 font-medium">Coordinator Signer</span>
                <div className="text-xs font-mono text-slate-900 font-semibold mt-1 break-all select-all">
                  0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf
                </div>
                <div className="text-slate-500 text-[11px] mt-0.5">Authorized Round Notary</div>
              </div>

              <div>
                <span className="text-[11px] uppercase tracking-wider text-slate-500 font-medium">Consensus Layer</span>
                <div className="text-xs font-semibold text-slate-900 mt-1">EVM Local Blockchain</div>
                <div className="text-slate-500 text-[11px] mt-0.5">Web3.py / py-evm Integration</div>
              </div>
            </div>

            <div className="p-5 bg-white border border-slate-200 rounded-lg space-y-3 shadow-xs">
              <div>
                <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider flex items-center space-x-2">
                  <FileCheck className="h-4 w-4 text-slate-700" />
                  <span>Verify Model Hash Against Smart Contract Commitment</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Calls the on-chain function <code className="text-slate-800 font-mono">verifyGlobalModel(roundId, modelHash)</code> to cryptographically check if candidate weights are authentic.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="number"
                  value={isNaN(verifyRoundId) ? "" : verifyRoundId}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setVerifyRoundId(isNaN(v) ? 0 : v);
                  }}
                  placeholder="Round"
                  className="w-24 bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 font-mono font-medium focus:outline-none focus:border-slate-900"
                />
                <input
                  type="text"
                  value={verifyHashInput}
                  onChange={(e) => setVerifyHashInput(e.target.value)}
                  placeholder="Paste 64-character SHA-256 model hash..."
                  className="flex-1 bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-900 font-mono font-medium focus:outline-none focus:border-slate-900"
                />
                <button
                  onClick={handleVerifyHash}
                  disabled={verifyingHash}
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded-md transition"
                >
                  {verifyingHash ? "Querying EVM..." : "Verify On-Chain"}
                </button>
              </div>

              {verifyResult && (
                <div className={`p-3 rounded-md border text-xs flex items-center justify-between ${
                  verifyResult.is_valid_on_chain
                    ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                    : "bg-rose-50 border-rose-200 text-rose-900"
                }`}>
                  <div className="flex items-center space-x-2">
                    {verifyResult.is_valid_on_chain ? (
                      <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-rose-600" />
                    )}
                    <span className="font-medium">
                      {verifyResult.is_valid_on_chain
                        ? "Authentic: Model weights match the cryptographic commitment on FraudAudit.sol"
                        : "Tamper Detected: Hash does NOT match the immutable on-chain record"}
                    </span>
                  </div>
                  <span className="font-mono text-xs">Round #{verifyResult.round_id}</span>
                </div>
              )}
            </div>

            <div className="p-5 bg-white border border-slate-200 rounded-lg space-y-4 shadow-xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div>
                  <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider flex items-center space-x-2">
                    <Layers className="h-4 w-4 text-slate-700" />
                    <span>On-Chain Cryptographic Blockchain Ledger</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {chainViewMode === "visual"
                      ? "Graphical block sequence linked by cryptographic hashes on FraudAudit.sol."
                      : "Detailed tabular ledger of on-chain training rounds and transaction receipts."}
                  </p>
                </div>

                <div className="flex bg-slate-100 p-0.5 rounded-md border border-slate-200 text-xs">
                  <button
                    onClick={() => setChainViewMode("visual")}
                    className={`px-3 py-1 rounded text-xs font-medium transition ${
                      chainViewMode === "visual" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Chain Diagram
                  </button>
                  <button
                    onClick={() => setChainViewMode("table")}
                    className={`px-3 py-1 rounded text-xs font-medium transition ${
                      chainViewMode === "table" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Ledger Table
                  </button>
                </div>
              </div>

              {chainViewMode === "visual" && (
                <div className="space-y-4">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-md flex items-center justify-between text-xs text-slate-600">
                    <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                      <span className="font-medium text-slate-800">Chain State: Cryptographically Linked & Immutable</span>
                    </div>
                    <span className="text-[11px] text-slate-500">Click any block to inspect its forensic record</span>
                  </div>

                  <div className="overflow-x-auto pb-2">
                    <div className="flex items-center space-x-3 min-w-max p-1">
                      <div
                        onClick={() => setSelectedBlockId(0)}
                        className={`w-60 p-4 rounded-lg border transition cursor-pointer select-none ${
                          selectedBlockId === 0
                            ? "bg-slate-100 border-slate-900 ring-1 ring-slate-900"
                            : "bg-white border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-mono text-[10px] font-medium">
                            BLOCK #0
                          </span>
                          <span className="text-slate-500 font-mono text-[10px]">GENESIS</span>
                        </div>
                        <div className="text-xs font-semibold text-slate-900 mb-1">Architecture Initialization</div>
                        <div className="text-[10px] text-slate-500 font-mono truncate">
                          Prev Hash: 0x0000000000...
                        </div>
                        <div className="mt-2.5 pt-2 border-t border-slate-100 text-xs text-slate-500 flex justify-between">
                          <span>EVM Launch</span>
                          <span className="text-emerald-700 font-medium">Verified</span>
                        </div>
                      </div>

                      {auditRounds.map((r, idx) => {
                        const blockIndex = idx + 1;
                        const isSelected = selectedBlockId === blockIndex;
                        const hasRejected = r.client_submissions?.some((s: any) => s.decision === "REJECTED");

                        return (
                          <React.Fragment key={`block-node-${r.round_id}-${idx}`}>
                            <div className="flex flex-col items-center text-slate-400 px-1">
                              <span className="text-[10px] font-mono text-slate-500 mb-0.5">SHA-256</span>
                              <div className="flex items-center space-x-1">
                                <div className="w-4 h-px bg-slate-300"></div>
                                <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                              </div>
                            </div>

                            <div
                              onClick={() => setSelectedBlockId(blockIndex)}
                              className={`w-64 p-4 rounded-lg border transition cursor-pointer select-none ${
                                isSelected
                                  ? "bg-slate-100 border-slate-900 ring-1 ring-slate-900"
                                  : "bg-white border-slate-200 hover:border-slate-300"
                              }`}
                            >
                              <div className="flex items-center justify-between text-xs mb-1.5">
                                <span className="px-2 py-0.5 bg-slate-900 text-white rounded font-mono text-[10px] font-medium">
                                  ROUND #{r.round_id}
                                </span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                                  hasRejected ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                }`}>
                                  {hasRejected ? "POISON DEFENDED" : "ALL ACCEPTED"}
                                </span>
                              </div>

                              <div className="text-xs font-semibold text-slate-900 mb-1">
                                Defense: {r.defense_strategy?.toUpperCase()}
                              </div>

                              <div className="text-[10px] text-slate-500 font-mono truncate" title={r.resulting_global_model_hash}>
                                Hash: {r.resulting_global_model_hash?.slice(0, 16)}...
                              </div>

                              <div className="mt-2.5 pt-2 border-t border-slate-100 text-[11px] text-slate-600 flex justify-between items-center">
                                <span className="font-mono">{r.client_submissions?.length ?? 3} Clients</span>
                                <span className="text-slate-500">Block #{r.blockchain_receipt?.block_number ?? 1}</span>
                              </div>
                            </div>
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>

                  {/* Forensic Block Inspector */}
                  {selectedBlockId !== null && (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-slate-900 text-xs">
                            {selectedBlockId === 0 ? "Genesis Block #0" : `On-Chain Round #${auditRounds[selectedBlockId - 1]?.round_id} Forensics`}
                          </span>
                        </div>
                        <button
                          onClick={() => setSelectedBlockId(null)}
                          className="text-slate-400 hover:text-slate-700 text-xs font-medium"
                        >
                          Close Details
                        </button>
                      </div>

                      {selectedBlockId === 0 ? (
                        <div className="space-y-1 text-slate-600 font-mono">
                          <div>Smart Contract: FraudAudit.sol</div>
                          <div>Genesis State: Clean State Initialized</div>
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {(() => {
                            const currentRoundData = auditRounds[selectedBlockId - 1];
                            if (!currentRoundData) return null;
                            return (
                              <>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono">
                                  <div className="p-2.5 bg-white border border-slate-200 rounded">
                                    <div className="text-[10px] text-slate-500 font-sans">Global Model State Hash:</div>
                                    <div className="text-xs text-slate-900 break-all select-all font-semibold mt-0.5">
                                      {currentRoundData.resulting_global_model_hash}
                                    </div>
                                  </div>
                                  <div className="p-2.5 bg-white border border-slate-200 rounded">
                                    <div className="text-[10px] text-slate-500 font-sans">On-Chain Transaction Hash:</div>
                                    <div className="text-xs text-slate-900 break-all select-all font-semibold mt-0.5">
                                      {currentRoundData.blockchain_receipt?.transaction_hash ?? "Local EVM Ledger Commitment"}
                                    </div>
                                  </div>
                                </div>

                                <div className="space-y-1.5 pt-1">
                                  <div className="font-semibold text-slate-800 text-[11px]">Client Update Proofs & Screening Verdicts:</div>
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    {currentRoundData.client_submissions?.map((sub: any, sIdx: number) => (
                                      <div key={sIdx} className="p-2.5 bg-white border border-slate-200 rounded space-y-1">
                                        <div className="flex justify-between items-center">
                                          <span className="font-semibold text-slate-900 uppercase">{sub.bank_id}</span>
                                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${
                                            sub.decision === "ACCEPTED" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"
                                          }`}>
                                            {sub.decision}
                                          </span>
                                        </div>
                                        <div className="text-[10px] text-slate-500 font-mono truncate" title={sub.update_hash}>
                                          {sub.update_hash?.slice(0, 14)}...
                                        </div>
                                        {sub.reason && <div className="text-[10px] text-slate-500">{sub.reason}</div>}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {chainViewMode === "table" && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse font-mono">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 font-sans font-medium uppercase text-[11px]">
                        <th className="py-2.5 px-3">Round ID</th>
                        <th className="py-2.5 px-3">Defense</th>
                        <th className="py-2.5 px-3">Global Model Hash</th>
                        <th className="py-2.5 px-3">Bank Submissions & Verdicts</th>
                        <th className="py-2.5 px-3">On-Chain Transaction</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {auditRounds.map((r, i) => (
                        <tr key={`table-round-${r.round_id}-${i}`} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-semibold text-slate-900">#{r.round_id}</td>
                          <td className="py-2.5 px-3 text-slate-700 font-semibold">{r.defense_strategy?.toUpperCase()}</td>
                          <td className="py-2.5 px-3 text-slate-700 truncate max-w-xs" title={r.resulting_global_model_hash}>
                            {r.resulting_global_model_hash?.slice(0, 16)}...
                          </td>
                          <td className="py-2.5 px-3 font-sans space-y-1">
                            {r.client_submissions?.map((sub: any, sIdx: number) => (
                              <div key={sIdx} className="flex items-center space-x-1.5 text-xs">
                                <span className="font-semibold text-slate-900">{sub.bank_id.toUpperCase()}:</span>
                                <span className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-medium ${
                                  sub.decision === "ACCEPTED" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"
                                }`}>
                                  {sub.decision}
                                </span>
                              </div>
                            ))}
                          </td>
                          <td className="py-2.5 px-3 font-sans text-slate-600 text-xs">
                            {r.blockchain_receipt?.transaction_hash ? (
                              <div>
                                <div className="text-slate-900 font-mono font-medium">Tx: {r.blockchain_receipt.transaction_hash.slice(0, 14)}...</div>
                                <div className="text-slate-500 text-[11px]">Block #{r.blockchain_receipt.block_number}</div>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">Off-Chain Backup</span>
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

        {/* PAGE 6 — AI & HEURISTIC ALGORITHMS LAB */}
        {activeTab === "algorithms" && (
          <div className="space-y-6">
            {/* Header Explainer Card */}
            <div className="p-5 bg-white border border-slate-200 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4 text-slate-900 shadow-xs">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <Network className="h-5 w-5 text-slate-700" />
                  <h3 className="text-sm font-semibold">Algorithmic & Heuristic Intelligence Suite</h3>
                  <span className="px-2 py-0.5 text-[10px] bg-slate-100 text-slate-700 border border-slate-200 rounded font-medium">
                    Graph Search & Meta-Heuristics
                  </span>
                </div>
                <p className="text-xs text-slate-500 max-w-3xl">
                  While neural networks (MLPs) detect single-transaction anomalies, <strong>Graph Search</strong> (BFS, DFS, Dijkstra, A*) uncovers multi-hop mule layering & wash cycles, and <strong>Forensic Heuristics</strong> (Benford's Law, Smurfing, Simulated Annealing, Bayesian Networks) provide causal reasoning and client optimization.
                </p>
              </div>

              <div className="flex items-center space-x-1.5 shrink-0 bg-slate-100 p-0.5 rounded-md border border-slate-200">
                <button
                  onClick={() => setAlgoTab("graph")}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition ${
                    algoTab === "graph" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Graph Traversal
                </button>
                <button
                  onClick={() => setAlgoTab("heuristics")}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition ${
                    algoTab === "heuristics" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Forensic Heuristics
                </button>
                <button
                  onClick={() => setAlgoTab("annealing")}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition ${
                    algoTab === "annealing" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Simulated Annealing
                </button>
                <button
                  onClick={() => {
                    setAlgoTab("bayesian");
                    if (!bayesianResult) handleRunBayesianQuery();
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition ${
                    algoTab === "bayesian" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Bayesian Network
                </button>
              </div>
            </div>

            {/* SUBTAB 1: GRAPH SEARCH (BFS, DFS, A*) */}
            {algoTab === "graph" && (
              <div className="space-y-6">
                {/* Visual Topology Diagram */}
                <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                    <div className="flex items-center space-x-2">
                      <Share2 className="h-4 w-4 text-slate-600" />
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-900">Multi-Bank Transaction Graph Topology</h4>
                      <span className="text-[11px] text-slate-400 font-mono">(Bank A Cards + Bank B PaySim + Bank C BankSim)</span>
                    </div>
                    <div className="flex items-center space-x-3 text-xs text-slate-600 font-medium">
                      <span className="flex items-center space-x-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block"></span> <span>Bank A</span></span>
                      <span className="flex items-center space-x-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block"></span> <span>Bank B</span></span>
                      <span className="flex items-center space-x-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-600 inline-block"></span> <span>Bank C</span></span>
                      <span className="flex items-center space-x-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-600 inline-block"></span> <span>Cashout Sink</span></span>
                    </div>
                  </div>

                  {/* SVG Topology Representation */}
                  <div className="bg-[#0B1120] rounded-lg p-4 overflow-x-auto border border-slate-800">
                    <svg viewBox="0 0 920 320" className="w-full h-72 min-w-[750px]">
                      <defs>
                        <marker id="arrow" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                          <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748B" />
                        </marker>
                        <marker id="arrow-fraud" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                          <path d="M 0 0 L 10 5 L 0 10 z" fill="#E11D48" />
                        </marker>
                        <marker id="arrow-cycle" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                          <path d="M 0 0 L 10 5 L 0 10 z" fill="#D97706" />
                        </marker>
                      </defs>

                      {/* Directed Edge lines */}
                      <line x1="120" y1="90" x2="340" y2="70" stroke={bfsResult?.traversal_sequence?.includes("B_MOBI_201") ? "#38BDF8" : "#E11D48"} strokeWidth="2" markerEnd="url(#arrow-fraud)" />
                      <text x="220" y="70" fill="#94A3B8" fontSize="10" fontFamily="monospace">$9,850 (P=0.88)</text>

                      <line x1="120" y1="90" x2="340" y2="150" stroke={bfsResult?.traversal_sequence?.includes("B_MOBI_202") ? "#38BDF8" : "#E11D48"} strokeWidth="1.5" markerEnd="url(#arrow-fraud)" />
                      <text x="210" y="130" fill="#94A3B8" fontSize="10" fontFamily="monospace">$9,500 (P=0.72)</text>

                      <line x1="340" y1="70" x2="560" y2="70" stroke={bfsResult?.traversal_sequence?.includes("B_MOBI_203") ? "#38BDF8" : "#E11D48"} strokeWidth="2" markerEnd="url(#arrow-fraud)" />
                      <text x="440" y="60" fill="#94A3B8" fontSize="10" fontFamily="monospace">$4,900 (P=0.84)</text>

                      <line x1="340" y1="70" x2="560" y2="170" stroke={bfsResult?.traversal_sequence?.includes("C_RETL_301") ? "#38BDF8" : "#E11D48"} strokeWidth="1.5" markerEnd="url(#arrow-fraud)" />
                      <text x="430" y="125" fill="#94A3B8" fontSize="10" fontFamily="monospace">$4,800 (P=0.79)</text>

                      <line x1="560" y1="70" x2="780" y2="110" stroke={astarResult?.path?.includes("C_RETL_302") ? "#F59E0B" : "#E11D48"} strokeWidth="2.5" markerEnd="url(#arrow-fraud)" />
                      <text x="660" y="80" fill="#F43F5E" fontSize="10" fontFamily="monospace">$4,750 (P=0.96) Cash-Out</text>

                      <line x1="560" y1="170" x2="780" y2="110" stroke="#E11D48" strokeWidth="1.5" markerEnd="url(#arrow-fraud)" />
                      <text x="660" y="155" fill="#94A3B8" fontSize="10" fontFamily="monospace">$4,600 (P=0.94)</text>

                      {/* DFS Circular Wash Cycle */}
                      <path d="M 560 170 Q 640 250 560 270" fill="none" stroke={dfsResult ? "#F59E0B" : "#475569"} strokeWidth="1.5" markerEnd="url(#arrow-cycle)" />
                      <text x="610" y="235" fill="#D97706" fontSize="9" fontFamily="monospace">Cycle Step 1</text>

                      <path d="M 560 270 Q 420 300 340 250" fill="none" stroke={dfsResult ? "#F59E0B" : "#475569"} strokeWidth="1.5" markerEnd="url(#arrow-cycle)" />
                      <text x="440" y="295" fill="#D97706" fontSize="9" fontFamily="monospace">Cycle Step 2</text>

                      <path d="M 340 250 Q 440 200 560 170" fill="none" stroke={dfsResult ? "#F59E0B" : "#475569"} strokeWidth="1.5" markerEnd="url(#arrow-cycle)" />
                      <text x="420" y="220" fill="#D97706" fontSize="9" fontFamily="monospace">Cycle Step 3 (Return)</text>

                      {/* Benign path */}
                      <line x1="120" y1="220" x2="120" y2="280" stroke="#334155" strokeWidth="1.5" markerEnd="url(#arrow)" />
                      <line x1="120" y1="280" x2="780" y2="260" stroke="#334155" strokeWidth="1.5" markerEnd="url(#arrow)" />

                      {/* Account Nodes */}
                      <g className="cursor-pointer">
                        <circle cx="120" cy="90" r="22" fill="#1E293B" stroke="#3B82F6" strokeWidth="2.5" />
                        <text x="120" y="88" fill="#F8FAFC" fontSize="9" fontWeight="bold" textAnchor="middle">A_CARD</text>
                        <text x="120" y="100" fill="#94A3B8" fontSize="8" fontFamily="monospace" textAnchor="middle">#901</text>
                        <text x="120" y="125" fill="#94A3B8" fontSize="8" textAnchor="middle">Suspect Origin</text>
                      </g>

                      <g className="cursor-pointer">
                        <circle cx="340" cy="70" r="20" fill="#1E293B" stroke="#10B981" strokeWidth="2" />
                        <text x="340" y="68" fill="#F8FAFC" fontSize="9" fontWeight="bold" textAnchor="middle">B_MOBI</text>
                        <text x="340" y="80" fill="#94A3B8" fontSize="8" fontFamily="monospace" textAnchor="middle">#201 (Mule)</text>
                      </g>

                      <g className="cursor-pointer">
                        <circle cx="340" cy="150" r="18" fill="#1E293B" stroke="#10B981" strokeWidth="1.5" />
                        <text x="340" y="148" fill="#F8FAFC" fontSize="8" fontWeight="bold" textAnchor="middle">B_MOBI</text>
                        <text x="340" y="159" fill="#94A3B8" fontSize="7" fontFamily="monospace" textAnchor="middle">#202</text>
                      </g>

                      <g className="cursor-pointer">
                        <circle cx="560" cy="70" r="20" fill="#1E293B" stroke="#10B981" strokeWidth="2" />
                        <text x="560" y="68" fill="#F8FAFC" fontSize="9" fontWeight="bold" textAnchor="middle">B_MOBI</text>
                        <text x="560" y="80" fill="#94A3B8" fontSize="8" fontFamily="monospace" textAnchor="middle">#203 (Mule)</text>
                      </g>

                      <g className="cursor-pointer">
                        <circle cx="560" cy="170" r="20" fill="#1E293B" stroke="#F59E0B" strokeWidth="2" />
                        <text x="560" y="168" fill="#F8FAFC" fontSize="9" fontWeight="bold" textAnchor="middle">C_RETL</text>
                        <text x="560" y="180" fill="#94A3B8" fontSize="8" fontFamily="monospace" textAnchor="middle">#301</text>
                      </g>

                      <g className="cursor-pointer">
                        <circle cx="560" cy="270" r="18" fill="#1E293B" stroke="#F59E0B" strokeWidth="1.5" />
                        <text x="560" y="268" fill="#F8FAFC" fontSize="8" fontWeight="bold" textAnchor="middle">C_RETL</text>
                        <text x="560" y="279" fill="#94A3B8" fontSize="7" fontFamily="monospace" textAnchor="middle">#303</text>
                      </g>

                      <g className="cursor-pointer">
                        <circle cx="340" cy="250" r="18" fill="#1E293B" stroke="#3B82F6" strokeWidth="1.5" />
                        <text x="340" y="248" fill="#F8FAFC" fontSize="8" fontWeight="bold" textAnchor="middle">A_CARD</text>
                        <text x="340" y="259" fill="#94A3B8" fontSize="7" fontFamily="monospace" textAnchor="middle">#902</text>
                      </g>

                      <g className="cursor-pointer">
                        <circle cx="780" cy="110" r="24" fill="#1E293B" stroke="#E11D48" strokeWidth="2.5" />
                        <text x="780" y="108" fill="#F8FAFC" fontSize="9" fontWeight="bold" textAnchor="middle">C_RETL_302</text>
                        <text x="780" y="120" fill="#FDA4AF" fontSize="8" fontFamily="monospace" textAnchor="middle">ATM / Sink</text>
                        <text x="780" y="148" fill="#E11D48" fontSize="8" textAnchor="middle">Target Cashout</text>
                      </g>

                      <circle cx="120" cy="220" r="14" fill="#1E293B" stroke="#475569" strokeWidth="1" />
                      <text x="120" y="224" fill="#94A3B8" fontSize="7" textAnchor="middle">A_105</text>
                      <circle cx="120" cy="280" r="14" fill="#1E293B" stroke="#475569" strokeWidth="1" />
                      <text x="120" y="284" fill="#94A3B8" fontSize="7" textAnchor="middle">A_440</text>
                      <circle cx="780" cy="260" r="14" fill="#1E293B" stroke="#475569" strokeWidth="1" />
                      <text x="780" y="264" fill="#94A3B8" fontSize="7" textAnchor="middle">C_700</text>
                    </svg>
                  </div>
                </div>

                {/* Algorithmic Control Grid (BFS, DFS, A*) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* ALGORITHM 1: BFS Money Mule Layering */}
                  <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs flex flex-col justify-between space-y-3">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <span className="p-1 bg-slate-100 text-slate-700 rounded text-[10px] font-mono font-medium">ALGO 1</span>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-900">BFS — Money Mule Layering</h4>
                      </div>
                      <p className="text-xs text-slate-500">
                        Breadth-First Search traverses level-by-level up to $K$ hops to identify rapid fund dispersion and layering across mule accounts.
                      </p>

                      <div className="space-y-1.5 pt-1">
                        <label className="text-[11px] font-medium text-slate-700">Root Suspect Account:</label>
                        <input
                          type="text"
                          value={bfsStartNode}
                          onChange={(e) => setBfsStartNode(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-xs font-mono font-medium text-slate-900"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[11px] font-medium text-slate-700">
                          <span>Max Depth:</span>
                          <span className="font-mono text-slate-900">{bfsMaxDepth} hops</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="4"
                          value={bfsMaxDepth}
                          onChange={(e) => setBfsMaxDepth(parseInt(e.target.value))}
                          className="w-full accent-slate-900"
                        />
                      </div>
                    </div>

                    <button
                      onClick={handleRunBFS}
                      disabled={loadingBFS}
                      className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-medium transition disabled:opacity-50"
                    >
                      {loadingBFS ? "Traversing..." : "Execute BFS Trace"}
                    </button>
                  </div>

                  {/* ALGORITHM 2: DFS Circular Wash Cycle Detection */}
                  <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs flex flex-col justify-between space-y-3">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <span className="p-1 bg-slate-100 text-slate-700 rounded text-[10px] font-mono font-medium">ALGO 2</span>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-900">DFS — Wash-Trading Cycles</h4>
                      </div>
                      <p className="text-xs text-slate-500">
                        Depth-First Search utilizes an active recursion stack to catch back-edges that form closed wash-trading loops (A → B → C → A).
                      </p>

                      <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs text-slate-600">
                        <div className="font-medium text-slate-800">Recursion Stack Tracking:</div>
                        <div>Detects closed circular routes in O(V + E) time without visiting duplicate permutations.</div>
                      </div>
                    </div>

                    <button
                      onClick={handleRunDFS}
                      disabled={loadingDFS}
                      className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-medium transition disabled:opacity-50"
                    >
                      {loadingDFS ? "Detecting Loops..." : "Detect Cycles (DFS)"}
                    </button>
                  </div>

                  {/* ALGORITHM 3: A* Informed Heuristic Search */}
                  <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs flex flex-col justify-between space-y-3">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <span className="p-1 bg-slate-100 text-slate-700 rounded text-[10px] font-mono font-medium">ALGO 3</span>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-900">A* vs Dijkstra Laundering Path</h4>
                      </div>
                      <p className="text-xs text-slate-500">
                        Uses admissible cashout proximity heuristic <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">f(n) = g(n) + h(n)</code> to accelerate escape pathfinding vs uninformed Dijkstra.
                      </p>

                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div>
                          <label className="text-[10px] font-medium text-slate-700">Origin:</label>
                          <input
                            type="text"
                            value={astarStartNode}
                            onChange={(e) => setAstarStartNode(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono font-medium"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-medium text-slate-700">Target:</label>
                          <input
                            type="text"
                            value={astarEndNode}
                            onChange={(e) => setAstarEndNode(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono font-medium"
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleRunAStar}
                      disabled={loadingAStar}
                      className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-medium transition disabled:opacity-50"
                    >
                      {loadingAStar ? "Evaluating..." : "Compare A* vs Dijkstra"}
                    </button>
                  </div>
                </div>

                {/* Live Algorithmic Output Results Panel */}
                {(bfsResult || dfsResult || astarResult) && (
                  <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 text-slate-200 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <div className="flex items-center space-x-2">
                        <Terminal className="h-4 w-4 text-slate-400" />
                        <h4 className="text-xs font-medium text-slate-200">Execution Output</h4>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono">Status: Verified</span>
                    </div>

                    {/* BFS Details */}
                    {bfsResult && (
                      <div className="space-y-2 bg-slate-900 p-3 rounded border border-slate-800 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-200">BFS Multi-Hop Result (Origin: {bfsResult.origin})</span>
                          <span className="px-2 py-0.5 bg-slate-800 text-slate-300 text-[10px] font-mono rounded">
                            {bfsResult.total_visited} Nodes Visited ({bfsResult.complexity})
                          </span>
                        </div>

                        <div className="text-slate-400">
                          <strong className="text-slate-200">Traversal Sequence: </strong>
                          <span className="font-mono text-slate-300">{bfsResult.traversal_sequence?.join(" -> ")}</span>
                        </div>

                        {bfsResult.flagged_mules?.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            <span className="text-xs font-medium text-slate-300">Identified Downstream Mules:</span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                              {bfsResult.flagged_mules.map((m: any, idx: number) => (
                                <div key={idx} className="bg-slate-950 p-2 rounded border border-slate-800 flex justify-between items-center">
                                  <div>
                                    <div className="font-mono font-medium text-slate-200">{m.account}</div>
                                    <div className="text-[10px] text-slate-500">{m.bank} · Layer {m.layer}</div>
                                  </div>
                                  <div className="text-right">
                                    <div className="font-mono font-medium text-slate-200">${m.exposure_amount?.toLocaleString()}</div>
                                    <div className="text-[10px] text-rose-400 font-mono">Fraud Prob: {m.fraud_score}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* DFS Details */}
                    {dfsResult && (
                      <div className="space-y-2 bg-slate-900 p-3 rounded border border-slate-800 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-200">DFS Circular Cycle Discovery</span>
                          <span className="px-2 py-0.5 bg-slate-800 text-slate-300 text-[10px] font-mono rounded">
                            {dfsResult.cycles_detected} Closed Cycles
                          </span>
                        </div>

                        {dfsResult.cycles?.map((cyc: any, cIdx: number) => (
                          <div key={cIdx} className="p-2.5 bg-slate-950 border border-slate-800 rounded space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-medium text-slate-200">{cyc.cycle_id}: {cyc.type}</span>
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-rose-950 text-rose-300 border border-rose-800">
                                {cyc.severity}
                              </span>
                            </div>
                            <div className="text-xs font-mono text-slate-300">
                              {cyc.nodes?.join(" -> ")}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Closed funds loop confirmed. Funds circulate back to origin party to fabricate volume or clean history.
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* A* vs Dijkstra Details */}
                    {astarResult && (
                      <div className="space-y-2 bg-slate-900 p-3 rounded border border-slate-800 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-200">A* Search vs. Dijkstra Performance Benchmark</span>
                          <span className="px-2 py-0.5 bg-slate-800 text-slate-300 text-[10px] font-mono rounded">
                            {astarResult.comparison?.heuristic_efficiency_gain}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          <div className="bg-slate-950 p-2.5 rounded border border-slate-800 space-y-1.5">
                            <div className="font-medium text-slate-200 flex justify-between">
                              <span>A* Informed Search:</span>
                              <span className="font-mono text-slate-300">{astarResult.astar?.nodes_expanded} Nodes Expanded</span>
                            </div>
                            <div className="text-slate-400 font-mono text-[11px]">
                              Route: {astarResult.astar?.path?.join(" -> ")}
                            </div>
                          </div>

                          <div className="bg-slate-950 p-2.5 rounded border border-slate-800 space-y-1.5">
                            <div className="font-medium text-slate-200 flex justify-between">
                              <span>Dijkstra (Uninformed):</span>
                              <span className="font-mono text-slate-400">{astarResult.dijkstra?.nodes_expanded} Nodes Expanded</span>
                            </div>
                            <div className="text-slate-400 font-mono text-[11px]">
                              Route: {astarResult.dijkstra?.path?.join(" -> ")}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* SUBTAB 2: FORENSIC HEURISTICS & BENFORD'S LAW */}
            {algoTab === "heuristics" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Benford's Law Chi-Square Analyzer */}
                  <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center space-x-2">
                        <span className="p-1 bg-slate-100 text-slate-700 rounded text-[10px] font-mono font-medium">HEURISTIC 1</span>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-900">Benford's Law Chi-Square Analyzer</h4>
                      </div>
                      <p className="text-xs text-slate-500">
                        In natural commercial banking, the frequency of leading digit <code className="font-mono">d</code> follows <code className="font-mono">P(d) = log10(1 + 1/d)</code> (~30.1% start with digit 1). Automated fraudulent scripts fabricate unnatural amounts that fail the <code className="font-mono">Chi-Square (χ²)</code> test.
                      </p>
                    </div>

                    <div className="flex space-x-2.5 pt-1">
                      <button
                        onClick={() => handleRunBenford(false)}
                        disabled={loadingBenford}
                        className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-medium transition disabled:opacity-50"
                      >
                        {loadingBenford && !benfordSynthetic ? "Testing..." : "Test Natural Transactions"}
                      </button>
                      <button
                        onClick={() => handleRunBenford(true)}
                        disabled={loadingBenford}
                        className="flex-1 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded text-xs font-medium transition disabled:opacity-50"
                      >
                        {loadingBenford && benfordSynthetic ? "Injecting..." : "Inject Fabricated Sample"}
                      </button>
                    </div>

                    {benfordResult && (
                      <div className="mt-3 p-4 bg-slate-900 rounded-lg text-slate-200 space-y-3 font-sans">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-400">Goodness-of-Fit Statistic:</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-mono font-medium ${
                            benfordResult.is_anomalous ? "bg-rose-950 text-rose-300 border border-rose-800" : "bg-emerald-950 text-emerald-300 border border-emerald-800"
                          }`}>
                            χ² = {benfordResult.chi_square_statistic} (Cutoff: {benfordResult.critical_threshold_p01})
                          </span>
                        </div>

                        <div className={`p-2.5 rounded text-xs font-medium ${
                          benfordResult.is_anomalous ? "bg-rose-950/50 border border-rose-800/60 text-rose-300" : "bg-emerald-950/50 border border-emerald-800/60 text-emerald-300"
                        }`}>
                          {benfordResult.risk_level}: {benfordResult.explanation}
                        </div>

                        <div className="space-y-1 pt-1">
                          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                            <span>Digit</span>
                            <span>Observed % (Bars) vs Expected Benford % (Marker)</span>
                          </div>
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => {
                            const obs = (benfordResult.observed_distribution?.[d] || 0) * 100;
                            const exp = (benfordResult.expected_distribution?.[d] || 0) * 100;
                            return (
                              <div key={d} className="flex items-center space-x-2 text-xs">
                                <span className="w-3 font-mono font-medium text-slate-400">{d}</span>
                                <div className="flex-1 bg-slate-800 rounded-full h-2 relative overflow-hidden">
                                  <div
                                    className={`h-full ${benfordResult.is_anomalous ? "bg-rose-500" : "bg-emerald-500"}`}
                                    style={{ width: `${Math.min(obs * 2, 100)}%` }}
                                  ></div>
                                </div>
                                <span className="w-20 text-[10px] font-mono text-slate-400 text-right">
                                  {obs.toFixed(1)}% ({exp.toFixed(1)}%)
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Smurfing & Structuring Heuristic */}
                  <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center space-x-2">
                        <span className="p-1 bg-slate-100 text-slate-700 rounded text-[10px] font-mono font-medium">HEURISTIC 2</span>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-900">AML Smurfing & Structuring Detector</h4>
                      </div>
                      <p className="text-xs text-slate-500">
                        Detects intentional structuring where transactions are engineered right below reporting limits (e.g., transfers of <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">$9,200 to $9,950</code> to evade the $10,000 regulatory AML audit threshold).
                      </p>
                    </div>

                    <div className="flex space-x-2.5 pt-1">
                      <button
                        onClick={() => handleRunSmurfing("smurfed")}
                        disabled={loadingSmurfing}
                        className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-medium transition disabled:opacity-50"
                      >
                        {loadingSmurfing && smurfingSampleType === "smurfed" ? "Auditing..." : "Audit Smurfed Batch ($9k+)"}
                      </button>
                      <button
                        onClick={() => handleRunSmurfing("normal")}
                        disabled={loadingSmurfing}
                        className="flex-1 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded text-xs font-medium transition disabled:opacity-50"
                      >
                        {loadingSmurfing && smurfingSampleType === "normal" ? "Auditing..." : "Audit Benign Transfers"}
                      </button>
                    </div>

                    {smurfingResult && (
                      <div className="mt-3 p-4 bg-slate-900 rounded-lg text-slate-200 space-y-3 font-sans">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400 font-medium">Monitored Band:</span>
                          <span className="font-mono text-slate-200 font-semibold">{smurfingResult.monitored_band}</span>
                        </div>

                        <div className={`p-2.5 rounded text-xs font-medium flex justify-between items-center ${
                          smurfingResult.structuring_detected ? "bg-rose-950/60 border border-rose-800/70 text-rose-300" : "bg-emerald-950/60 border border-emerald-800/70 text-emerald-300"
                        }`}>
                          <span>{smurfingResult.structuring_detected ? "Structuring Violation Flagged" : "No Structuring Detected"}</span>
                          <span className="px-2 py-0.5 rounded bg-black/40 text-[10px] font-mono">{smurfingResult.heuristic_action}</span>
                        </div>

                        <div className="space-y-1 pt-1">
                          <div className="text-[10px] font-medium text-slate-400">Flagged Transactions:</div>
                          {smurfingResult.flagged_transactions?.map((tx: any, idx: number) => (
                            <div key={idx} className="p-2 bg-slate-950 rounded flex justify-between items-center text-xs font-mono">
                              <div>
                                <span className="text-slate-200 font-semibold">{tx.tx_id}</span>
                                <span className="text-slate-500 text-[10px] ml-2">({tx.sender} &rarr; {tx.receiver})</span>
                              </div>
                              <span className="text-rose-400 font-semibold">${tx.amount?.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* SUBTAB 3: SIMULATED ANNEALING CLIENT WEIGHT OPTIMIZATION */}
            {algoTab === "annealing" && (
              <div className="space-y-6">
                <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center space-x-2">
                      <span className="p-1 bg-slate-100 text-slate-700 rounded text-[10px] font-mono font-medium">META-HEURISTIC</span>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-900">Simulated Annealing Client Weight Optimizer</h4>
                    </div>
                    <p className="text-xs text-slate-500">
                      Standard FedAvg assigns client weights based strictly on sample size. When banks present heterogeneous latency and anomaly risk, <strong>Simulated Annealing</strong> explores client combinations to maximize PR-AUC while penalizing latency and Frobenius norm deviation.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
                    <div className="flex space-x-4 text-xs text-slate-600 font-medium">
                      <span>T₀ = <strong className="font-mono text-slate-900">100.0</strong></span>
                      <span>Cooling α = <strong className="font-mono text-slate-900">0.92</strong></span>
                      <span>Iterations = <strong className="font-mono text-slate-900">150 steps</strong></span>
                    </div>

                    <button
                      onClick={handleRunSA}
                      disabled={loadingSA}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-medium transition disabled:opacity-50"
                    >
                      {loadingSA ? "Annealing..." : "Run Simulated Annealing"}
                    </button>
                  </div>

                  {saResult && (
                    <div className="mt-3 p-4 bg-slate-900 rounded-lg text-slate-200 space-y-3 font-sans">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-xs">
                        <span className="font-medium text-slate-200">Optimal Aggregation Weights Converged</span>
                        <span className="px-2 py-0.5 bg-slate-800 text-slate-300 text-xs font-mono rounded">
                          Best Fitness: {saResult.best_fitness_score}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {Object.entries(saResult.optimized_client_weights || {}).map(([bankName, weight]: [string, any], idx) => (
                          <div key={idx} className="bg-slate-950 p-3 rounded border border-slate-800 space-y-1.5">
                            <div className="text-xs text-slate-400 font-medium truncate">{bankName}</div>
                            <div className="text-lg font-bold font-mono text-slate-100">
                              {(weight * 100).toFixed(1)}%
                            </div>
                            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="h-full bg-slate-300 rounded-full"
                                style={{ width: `${Math.min(weight * 100, 100)}%` }}
                              ></div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="space-y-1.5 pt-1">
                        <div className="text-[11px] font-medium text-slate-400">Cooling Trajectory Samples:</div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs font-mono text-slate-300">
                            <thead>
                              <tr className="border-b border-slate-800 text-slate-500 font-medium text-[10px]">
                                <th className="py-1 px-2">Step</th>
                                <th className="py-1 px-2">Temp (T)</th>
                                <th className="py-1 px-2">Fitness</th>
                                <th className="py-1 px-2">Weights [A, B, C]</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/40">
                              {saResult.cooling_history?.map((h: any, sIdx: number) => (
                                <tr key={sIdx} className="hover:bg-slate-800/20">
                                  <td className="py-1 px-2 text-slate-400">#{h.step}</td>
                                  <td className="py-1 px-2 text-slate-500">{h.temp}°</td>
                                  <td className="py-1 px-2 text-slate-200">{h.fitness}</td>
                                  <td className="py-1 px-2 text-slate-300 font-mono">[{h.weights.join(", ")}]</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SUBTAB 4: BAYESIAN BELIEF NETWORK */}
            {algoTab === "bayesian" && (
              <div className="space-y-6">
                <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="p-1 bg-slate-100 text-slate-700 rounded text-[10px] font-mono font-medium">PROBABILISTIC AI</span>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-900">Bayesian Belief Network — Causal Fraud Inference & XAI</h4>
                      </div>
                      <p className="text-xs text-slate-500">
                        Evaluates exact conditional probability distributions <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">P(Fraud | Evidence)</code> using <strong>Exact Variable Elimination</strong>. Enables regulatory causal explainability and reasoning under partial data.
                      </p>
                    </div>

                    <div className="flex space-x-2 shrink-0">
                      <button
                        onClick={() => {
                          const empty = {};
                          setBayesianEvidence(empty);
                          handleRunBayesianQuery(empty);
                        }}
                        className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded transition"
                      >
                        Reset Evidence
                      </button>
                      <button
                        onClick={() => {
                          const preset = { TimeRisk: "ODD_HOURS", ChannelRisk: "HIGH_RISK", AmountSpike: "SPIKE", BalanceEmptied: "YES" };
                          setBayesianEvidence(preset);
                          handleRunBayesianQuery(preset);
                        }}
                        className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded transition"
                      >
                        Load Preset: Account Takeover
                      </button>
                    </div>
                  </div>

                  {/* Interactive Causal DAG Visualizer (SVG) */}
                  <div className="bg-[#0B1120] rounded-lg p-4 overflow-x-auto border border-slate-800">
                    <div className="text-[11px] font-mono text-slate-400 mb-2 flex justify-between">
                      <span>Probabilistic Directed Acyclic Graph (DAG)</span>
                      <span className="text-slate-400">Active evidence nodes highlighted with rings</span>
                    </div>

                    <svg viewBox="0 0 860 260" className="w-full h-64 min-w-[700px]">
                      <defs>
                        <marker id="bayesian-arrow" viewBox="0 0 10 10" refX="22" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                          <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748B" />
                        </marker>
                      </defs>

                      {/* DAG Directed Edges */}
                      <line x1="120" y1="60" x2="340" y2="60" stroke="#475569" strokeWidth="1.5" markerEnd="url(#bayesian-arrow)" />
                      <line x1="120" y1="160" x2="340" y2="60" stroke="#475569" strokeWidth="1.5" markerEnd="url(#bayesian-arrow)" />
                      <line x1="120" y1="60" x2="540" y2="110" stroke="#475569" strokeWidth="1.5" markerEnd="url(#bayesian-arrow)" />
                      <line x1="120" y1="160" x2="540" y2="110" stroke="#475569" strokeWidth="1.5" markerEnd="url(#bayesian-arrow)" />
                      <line x1="340" y1="60" x2="540" y2="110" stroke="#475569" strokeWidth="2" markerEnd="url(#bayesian-arrow)" />
                      <line x1="540" y1="110" x2="740" y2="60" stroke="#64748B" strokeWidth="2" markerEnd="url(#bayesian-arrow)" />
                      <line x1="540" y1="110" x2="740" y2="160" stroke="#64748B" strokeWidth="2" markerEnd="url(#bayesian-arrow)" />

                      {/* Node: TimeRisk */}
                      <g className="cursor-pointer" onClick={() => toggleEvidence("TimeRisk", "ODD_HOURS")}>
                        <circle
                          cx="120"
                          cy="60"
                          r="26"
                          fill="#1E293B"
                          stroke={bayesianEvidence.TimeRisk ? "#38BDF8" : "#475569"}
                          strokeWidth={bayesianEvidence.TimeRisk ? "2.5" : "1"}
                        />
                        <text x="120" y="58" fill="#F8FAFC" fontSize="10" fontWeight="bold" textAnchor="middle">TimeRisk</text>
                        <text x="120" y="70" fill="#94A3B8" fontSize="8" fontFamily="monospace" textAnchor="middle">
                          {bayesianEvidence.TimeRisk || "Marginal"}
                        </text>
                      </g>

                      {/* Node: ChannelRisk */}
                      <g className="cursor-pointer" onClick={() => toggleEvidence("ChannelRisk", "HIGH_RISK")}>
                        <circle
                          cx="120"
                          cy="160"
                          r="26"
                          fill="#1E293B"
                          stroke={bayesianEvidence.ChannelRisk ? "#38BDF8" : "#475569"}
                          strokeWidth={bayesianEvidence.ChannelRisk ? "2.5" : "1"}
                        />
                        <text x="120" y="158" fill="#F8FAFC" fontSize="10" fontWeight="bold" textAnchor="middle">Channel</text>
                        <text x="120" y="170" fill="#94A3B8" fontSize="8" fontFamily="monospace" textAnchor="middle">
                          {bayesianEvidence.ChannelRisk || "Marginal"}
                        </text>
                      </g>

                      {/* Node: AmountSpike */}
                      <g className="cursor-pointer" onClick={() => toggleEvidence("AmountSpike", "SPIKE")}>
                        <circle
                          cx="340"
                          cy="60"
                          r="28"
                          fill="#1E293B"
                          stroke={bayesianEvidence.AmountSpike ? "#38BDF8" : "#475569"}
                          strokeWidth={bayesianEvidence.AmountSpike ? "2.5" : "1"}
                        />
                        <text x="340" y="58" fill="#F8FAFC" fontSize="10" fontWeight="bold" textAnchor="middle">AmountSpike</text>
                        <text x="340" y="70" fill="#94A3B8" fontSize="8" fontFamily="monospace" textAnchor="middle">
                          {bayesianEvidence.AmountSpike || "Marginal"}
                        </text>
                      </g>

                      {/* Central Target Node: IsFraud (F) */}
                      <g>
                        <circle
                          cx="540"
                          cy="110"
                          r="34"
                          fill="#1E293B"
                          stroke={bayesianResult?.fraud_posterior > 0.5 ? "#E11D48" : "#10B981"}
                          strokeWidth="2.5"
                        />
                        <text x="540" y="104" fill="#FFFFFF" fontSize="11" fontWeight="bold" textAnchor="middle">IsFraud (F)</text>
                        <text x="540" y="120" fill="#E2E8F0" fontSize="10" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                          {bayesianResult ? `${(bayesianResult.fraud_posterior * 100).toFixed(1)}%` : "Target"}
                        </text>
                        <text x="540" y="158" fill="#94A3B8" fontSize="9" textAnchor="middle">Target Decision Node</text>
                      </g>

                      {/* Node: BalanceEmptied */}
                      <g className="cursor-pointer" onClick={() => toggleEvidence("BalanceEmptied", "YES")}>
                        <circle
                          cx="740"
                          cy="60"
                          r="26"
                          fill="#1E293B"
                          stroke={bayesianEvidence.BalanceEmptied ? "#38BDF8" : "#475569"}
                          strokeWidth={bayesianEvidence.BalanceEmptied ? "2.5" : "1"}
                        />
                        <text x="740" y="58" fill="#F8FAFC" fontSize="9" fontWeight="bold" textAnchor="middle">ZeroBal (B)</text>
                        <text x="740" y="70" fill="#94A3B8" fontSize="8" fontFamily="monospace" textAnchor="middle">
                          {bayesianEvidence.BalanceEmptied || "Marginal"}
                        </text>
                      </g>

                      {/* Node: RapidMuleOutflow */}
                      <g className="cursor-pointer" onClick={() => toggleEvidence("RapidMuleOutflow", "YES")}>
                        <circle
                          cx="740"
                          cy="160"
                          r="26"
                          fill="#1E293B"
                          stroke={bayesianEvidence.RapidMuleOutflow ? "#38BDF8" : "#475569"}
                          strokeWidth={bayesianEvidence.RapidMuleOutflow ? "2.5" : "1"}
                        />
                        <text x="740" y="158" fill="#F8FAFC" fontSize="9" fontWeight="bold" textAnchor="middle">MuleFan (M)</text>
                        <text x="740" y="170" fill="#94A3B8" fontSize="8" fontFamily="monospace" textAnchor="middle">
                          {bayesianEvidence.RapidMuleOutflow || "Marginal"}
                        </text>
                      </g>
                    </svg>
                  </div>

                  {/* Evidence Toggles Bar */}
                  <div className="space-y-2 pt-1">
                    <div className="text-xs font-semibold text-slate-800 flex justify-between items-center">
                      <span>Observe Evidence on Network Factors:</span>
                      <span className="text-[11px] font-mono text-slate-500">
                        {Object.keys(bayesianEvidence).length} Factors Observed
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                      {/* TimeRisk Toggle */}
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-1.5">
                        <div className="text-[10px] font-medium text-slate-500 uppercase">Time Anomaly:</div>
                        <div className="flex flex-col space-y-1">
                          <button
                            onClick={() => toggleEvidence("TimeRisk", "NORMAL")}
                            className={`px-2 py-1 text-[11px] font-medium rounded text-left transition ${
                              bayesianEvidence.TimeRisk === "NORMAL" ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-700"
                            }`}
                          >
                            Normal Hours
                          </button>
                          <button
                            onClick={() => toggleEvidence("TimeRisk", "ODD_HOURS")}
                            className={`px-2 py-1 text-[11px] font-medium rounded text-left transition ${
                              bayesianEvidence.TimeRisk === "ODD_HOURS" ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-700"
                            }`}
                          >
                            Odd / Off-Hours
                          </button>
                        </div>
                      </div>

                      {/* ChannelRisk Toggle */}
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-1.5">
                        <div className="text-[10px] font-medium text-slate-500 uppercase">Channel / Device:</div>
                        <div className="flex flex-col space-y-1">
                          <button
                            onClick={() => toggleEvidence("ChannelRisk", "STANDARD")}
                            className={`px-2 py-1 text-[11px] font-medium rounded text-left transition ${
                              bayesianEvidence.ChannelRisk === "STANDARD" ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-700"
                            }`}
                          >
                            Regular Merchant
                          </button>
                          <button
                            onClick={() => toggleEvidence("ChannelRisk", "HIGH_RISK")}
                            className={`px-2 py-1 text-[11px] font-medium rounded text-left transition ${
                              bayesianEvidence.ChannelRisk === "HIGH_RISK" ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-700"
                            }`}
                          >
                            Wire / Outflow
                          </button>
                        </div>
                      </div>

                      {/* AmountSpike Toggle */}
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-1.5">
                        <div className="text-[10px] font-medium text-slate-500 uppercase">Amount Deviation:</div>
                        <div className="flex flex-col space-y-1">
                          <button
                            onClick={() => toggleEvidence("AmountSpike", "NORMAL")}
                            className={`px-2 py-1 text-[11px] font-medium rounded text-left transition ${
                              bayesianEvidence.AmountSpike === "NORMAL" ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-700"
                            }`}
                          >
                            Typical Volume
                          </button>
                          <button
                            onClick={() => toggleEvidence("AmountSpike", "SPIKE")}
                            className={`px-2 py-1 text-[11px] font-medium rounded text-left transition ${
                              bayesianEvidence.AmountSpike === "SPIKE" ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-700"
                            }`}
                          >
                            Spike Anomaly
                          </button>
                        </div>
                      </div>

                      {/* BalanceEmptied Toggle */}
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-1.5">
                        <div className="text-[10px] font-medium text-slate-500 uppercase">Account Balance:</div>
                        <div className="flex flex-col space-y-1">
                          <button
                            onClick={() => toggleEvidence("BalanceEmptied", "NO")}
                            className={`px-2 py-1 text-[11px] font-medium rounded text-left transition ${
                              bayesianEvidence.BalanceEmptied === "NO" ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-700"
                            }`}
                          >
                            Balance Retained
                          </button>
                          <button
                            onClick={() => toggleEvidence("BalanceEmptied", "YES")}
                            className={`px-2 py-1 text-[11px] font-medium rounded text-left transition ${
                              bayesianEvidence.BalanceEmptied === "YES" ? "bg-rose-600 text-white" : "bg-white border border-slate-200 text-slate-700"
                            }`}
                          >
                            Drained to Zero
                          </button>
                        </div>
                      </div>

                      {/* RapidMuleOutflow Toggle */}
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-1.5">
                        <div className="text-[10px] font-medium text-slate-500 uppercase">Downstream Mule:</div>
                        <div className="flex flex-col space-y-1">
                          <button
                            onClick={() => toggleEvidence("RapidMuleOutflow", "NO")}
                            className={`px-2 py-1 text-[11px] font-medium rounded text-left transition ${
                              bayesianEvidence.RapidMuleOutflow === "NO" ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-700"
                            }`}
                          >
                            Standard Payee
                          </button>
                          <button
                            onClick={() => toggleEvidence("RapidMuleOutflow", "YES")}
                            className={`px-2 py-1 text-[11px] font-medium rounded text-left transition ${
                              bayesianEvidence.RapidMuleOutflow === "YES" ? "bg-rose-600 text-white" : "bg-white border border-slate-200 text-slate-700"
                            }`}
                          >
                            Mule Fan-Out
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Live Bayesian Output Card */}
                  {bayesianResult && (
                    <div className="mt-3 p-4 bg-slate-900 rounded-lg text-slate-200 space-y-3 font-sans">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                        <div className="flex items-center space-x-2">
                          <Sparkles className="h-4 w-4 text-slate-400" />
                          <h4 className="text-xs font-semibold text-slate-200">Exact Bayesian Posterior Belief State</h4>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-slate-400">Prior: <strong>{(bayesianResult.fraud_prior_baseline * 100).toFixed(1)}%</strong></span>
                          <span className="text-slate-600">&rarr;</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-mono font-medium ${
                            bayesianResult.fraud_posterior > 0.5 ? "bg-rose-950 text-rose-300 border border-rose-800" : "bg-emerald-950 text-emerald-300 border border-emerald-800"
                          }`}>
                            Posterior: {(bayesianResult.fraud_posterior * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      {/* Hero Causal Verdict */}
                      <div className={`p-3.5 rounded-lg border flex flex-col md:flex-row justify-between items-start md:items-center gap-3 ${
                        bayesianResult.fraud_posterior >= 0.70
                          ? "bg-rose-950/40 border-rose-800 text-rose-200"
                          : bayesianResult.fraud_posterior >= 0.25
                          ? "bg-amber-950/40 border-amber-800 text-amber-200"
                          : "bg-emerald-950/40 border-emerald-800 text-emerald-200"
                      }`}>
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="px-1.5 py-0.5 rounded bg-black/40 text-[10px] font-mono font-medium">
                              {bayesianResult.verdict}
                            </span>
                            <span className="text-xs font-medium text-slate-200">
                              Risk Factor Multiplier: <span className="font-mono text-white font-bold">{bayesianResult.risk_multiplier}x</span>
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 max-w-3xl">
                            {bayesianResult.causal_explanation}
                          </p>
                        </div>
                        <button
                          onClick={() => handleRunBayesianQuery()}
                          className="px-3 py-1.5 bg-white text-slate-900 rounded font-medium text-xs shrink-0 hover:bg-slate-100 transition"
                        >
                          Recalculate
                        </button>
                      </div>

                      {/* Marginal Distributions Grid */}
                      <div className="space-y-1.5 pt-1">
                        <div className="text-[11px] font-medium text-slate-400">Marginal Probabilities for Network Variables:</div>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                          {Object.entries(bayesianResult.posterior_distributions || {}).map(([varName, states]: [string, any], vIdx) => {
                            const isObserved = bayesianEvidence[varName] !== undefined;
                            const mainState = Object.keys(states)[1];
                            const mainProb = (states[mainState] * 100).toFixed(1);
                            return (
                              <div key={vIdx} className={`p-2.5 rounded border space-y-1 ${
                                isObserved ? "bg-slate-800 border-slate-600" : "bg-slate-950 border-slate-800"
                              }`}>
                                <div className="flex justify-between items-center text-[10px]">
                                  <span className="font-medium text-slate-400 truncate">{varName}</span>
                                  {isObserved && <span className="text-[9px] font-mono text-slate-300">OBS</span>}
                                </div>
                                <div className="text-base font-bold font-mono text-slate-100">
                                  {mainProb}%
                                </div>
                                <div className="text-[10px] text-slate-500 font-mono">
                                  P({mainState})
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white px-6 py-4 text-center text-xs text-slate-500 font-medium">
        CrossBank TrustFL — Federated Learning & Blockchain Audit for Multi-Bank Fraud Detection
      </footer>
    </div>
  );
}
