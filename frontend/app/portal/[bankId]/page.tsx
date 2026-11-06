"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Shield,
  ShieldCheck,
  Cpu,
  Layers,
  Database,
  CheckCircle2,
  AlertTriangle,
  Play,
  Upload,
  RefreshCw,
  Vote,
  ExternalLink,
  ChevronLeft,
  ArrowRight,
  FileCheck,
  Building2,
  Lock,
  Wallet,
  KeyRound,
  LogOut
} from "lucide-react";
import * as api from "../../api";

function BankPortalContent() {
  const params = useParams();
  const router = useRouter();
  const rawBankId = (params?.bankId as string) || "bank_a";
  const bankId = rawBankId.toLowerCase();

  const [bankData, setBankData] = useState<any>(null);
  const [loadingPortal, setLoadingPortal] = useState(true);

  // Local Training States
  const [trainingEpochs, setTrainingEpochs] = useState(1);
  const [isTrainingLocal, setIsTrainingLocal] = useState(false);
  const [localTrainResult, setLocalTrainResult] = useState<any>(null);

  // On-Chain Submit States
  const [isSubmittingOnChain, setIsSubmittingOnChain] = useState(false);
  const [submitResult, setSubmitResult] = useState<any>(null);

  // Upload Checkpoint States
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);

  // Validation States
  const [isValidatingGlobal, setIsValidatingGlobal] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);

  // Multi-Sig Approval States
  const [isApproving, setIsApproving] = useState(false);
  const [approvalResult, setApprovalResult] = useState<any>(null);

  // MetaMask States
  const [walletAddress, setWalletAddress] = useState("");
  const [walletConnected, setWalletConnected] = useState(false);

  // Simple ID/Password Authentication States (No arbitrary toggle!)
  const normalizedBankId = bankId.replace("-", "_");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [inputUsername, setInputUsername] = useState(normalizedBankId);
  const [inputPassword, setInputPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    setInputUsername(normalizedBankId);
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(`auth_session_${normalizedBankId}`);
      if (stored === "true") {
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
    }
  }, [bankId, normalizedBankId]);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoggingIn(true);
    setLoginError("");
    try {
      let activeAddr = walletAddress;
      if (typeof window !== "undefined" && (window as any).ethereum) {
        try {
          const accounts = await (window as any).ethereum.request({ method: "eth_requestAccounts" });
          if (accounts && accounts.length > 0) {
            activeAddr = accounts[0];
            setWalletAddress(activeAddr);
            setWalletConnected(true);
          }
        } catch (_) {}
      }

      const res = await api.bankLogin({
        username: inputUsername,
        password: inputPassword,
        wallet_address: activeAddr || undefined,
      });
      setIsAuthenticated(true);
      if (typeof window !== "undefined") {
        localStorage.setItem(`auth_session_${normalizedBankId}`, "true");
        localStorage.setItem("active_bank_role", res.role);
      }
      await loadBankData();
    } catch (err: any) {
      setLoginError(err.message || "Invalid Bank ID or Password");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setInputPassword("");
    if (typeof window !== "undefined") {
      localStorage.removeItem(`auth_session_${normalizedBankId}`);
      localStorage.removeItem("active_bank_role");
    }
  };

  const handleSwitchAccount = async () => {
    if (typeof window === "undefined" || !(window as any).ethereum) {
      alert("MetaMask extension not found.");
      return;
    }
    try {
      const eth = (window as any).ethereum;
      await eth.request({
        method: "wallet_requestPermissions",
        params: [{ eth_accounts: {} }],
      });
      const accounts = await eth.request({ method: "eth_accounts" });
      if (accounts && accounts.length > 0) {
        const addr = accounts[0];
        setWalletAddress(addr);
        setWalletConnected(true);
        await api.syncUserWallet(addr, normalizedBankId);
        await loadBankData();
        alert(`Switched to account ${addr.slice(0, 6)}...${addr.slice(-4)} and bound to ${meta.name || bankId.toUpperCase()}!`);
      }
    } catch (e: any) {
      if (e.code !== 4001) {
        console.warn("Account switcher error:", e);
      }
    }
  };

  const handleAccountChanged = async (accounts: string[]) => {
    if (accounts && accounts.length > 0) {
      const addr = accounts[0];
      setWalletAddress(addr);
      setWalletConnected(true);
      if (isAuthenticated) {
        try {
          await api.syncUserWallet(addr, normalizedBankId);
          await loadBankData();
        } catch (err) {
          console.warn("Wallet sync failed:", err);
        }
      }
    } else {
      setWalletAddress("");
      setWalletConnected(false);
    }
  };

  useEffect(() => {
    loadBankData();
    checkMetaMask();
    if (typeof window !== "undefined" && (window as any).ethereum) {
      (window as any).ethereum.on("accountsChanged", handleAccountChanged);
      return () => {
        try {
          (window as any).ethereum.removeListener("accountsChanged", handleAccountChanged);
        } catch (_) {}
      };
    }
  }, [bankId, isAuthenticated]);

  const loadBankData = async () => {
    setLoadingPortal(true);
    try {
      const data = await api.getBankPortalDetails(bankId);
      setBankData(data);
    } catch (err: any) {
      console.error("Failed to load bank portal:", err);
    } finally {
      setLoadingPortal(false);
    }
  };

  const checkMetaMask = async () => {
    if (typeof window !== "undefined" && (window as any).ethereum) {
      try {
        const accounts = await (window as any).ethereum.request({ method: "eth_accounts" });
        if (accounts && accounts.length > 0) {
          const addr = accounts[0];
          setWalletAddress(addr);
          setWalletConnected(true);
          const role = bankId.replace("-", "_");
          await api.syncUserWallet(addr, role);
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleConnectWallet = async () => {
    if (typeof window === "undefined" || !(window as any).ethereum) {
      alert("MetaMask extension not found. Please install MetaMask to interact with Sepolia.");
      return;
    }
    try {
      const accounts = await (window as any).ethereum.request({ method: "eth_requestAccounts" });
      const addr = accounts[0];
      setWalletAddress(addr);
      setWalletConnected(true);
      const role = bankId.replace("-", "_");
      await api.syncUserWallet(addr, role);
      await loadBankData();
    } catch (e: any) {
      alert("MetaMask connection failed: " + e.message);
    }
  };

  const handleTrainLocal = async () => {
    setIsTrainingLocal(true);
    setLocalTrainResult(null);
    try {
      const res = await api.trainLocalBank(bankId, trainingEpochs);
      setLocalTrainResult(res);
      await loadBankData();
    } catch (err: any) {
      alert("Local private training failed: " + err.message);
    } finally {
      setIsTrainingLocal(false);
    }
  };

  const handleSubmitOnChain = async () => {
    setIsSubmittingOnChain(true);
    setSubmitResult(null);
    try {
      const res = await api.submitBankUpdateOnChain(bankId);
      setSubmitResult(res);
      alert(`Model update hash successfully registered for ${bankId.toUpperCase()} on FraudAudit.sol!`);
    } catch (err: any) {
      alert("Failed to register on-chain update: " + err.message);
    } finally {
      setIsSubmittingOnChain(false);
    }
  };

  const handleValidateGlobal = async () => {
    setIsValidatingGlobal(true);
    setValidationResult(null);
    try {
      const res = await api.validateGlobalOnBank(bankId);
      setValidationResult(res);
    } catch (err: any) {
      alert("Validation failed: " + err.message);
    } finally {
      setIsValidatingGlobal(false);
    }
  };

  const handleUploadFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      alert("Please select a PyTorch .pt or .pth checkpoint file first.");
      return;
    }
    setIsUploading(true);
    setUploadResult(null);
    try {
      const res = await api.uploadBankModelCheckpoint(bankId, uploadFile);
      setUploadResult(res);
      alert(`Model checkpoint verified and loaded successfully! SHA-256: ${res.weights_hash.slice(0, 16)}...`);
    } catch (err: any) {
      alert("Checkpoint upload failed: " + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleApproveRound = async () => {
    setIsApproving(true);
    setApprovalResult(null);
    try {
      const targetAddress = walletAddress || bankData?.wallet_address;
      const res = await api.approveRoundBackend(1, targetAddress);
      setApprovalResult(res);
      alert(`Consortium approval recorded on-chain for Round #1 by ${bankId.toUpperCase()}!`);
    } catch (err: any) {
      alert("Approval transaction failed: " + err.message);
    } finally {
      setIsApproving(false);
    }
  };

  const meta = bankData?.metadata || {};
  const isAuthorizedSigner =
    walletConnected &&
    bankData?.wallet_address &&
    walletAddress.toLowerCase() === bankData.wallet_address.toLowerCase();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-50 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link
            href="/"
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-lg transition"
            title="Return to Main Consortium Hub"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <div className="p-2 bg-slate-900 text-white rounded-lg">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-semibold tracking-tight text-slate-900">{meta.name || "Bank Node Portal"}</h1>
              <span className="px-2 py-0.5 text-[11px] font-mono font-medium bg-slate-100 text-slate-700 border border-slate-200 rounded">
                Sovereign Node
              </span>
            </div>
            <p className="text-xs text-slate-500">Private Data Vault, Local Model Fine-Tuning & On-Chain Quorum Approval</p>
          </div>
        </div>

        {/* Node Authentication & Wallet */}
        <div className="flex items-center space-x-2.5">
          {isAuthenticated ? (
            <div className="flex items-center space-x-2 bg-emerald-50 border border-emerald-200 rounded-md px-2.5 py-1 text-xs font-medium text-emerald-800">
              <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
              <span>Authenticated: {meta.name?.split("—")[0].trim()}</span>
              <button
                onClick={handleLogout}
                className="ml-1 text-slate-400 hover:text-rose-600 transition flex items-center"
                title="Log out of this sovereign bank node"
              >
                <LogOut className="w-3.5 h-3.5 ml-0.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-1.5 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1 text-xs font-medium text-amber-800">
              <Lock className="w-3.5 h-3.5 text-amber-600" />
              <span>Authentication Required</span>
            </div>
          )}

          {walletConnected ? (
            <div className="flex items-center space-x-2 bg-slate-900 text-white rounded-md px-2.5 py-1 text-xs font-medium border border-slate-800">
              <span className={`w-2 h-2 rounded-full ${isAuthorizedSigner ? "bg-emerald-400" : "bg-amber-400"}`}></span>
              <span className="font-mono">{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</span>
              {isAuthorizedSigner ? (
                <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-1.5 py-0.5 rounded font-medium">
                  Authorized Signer
                </span>
              ) : (
                <button
                  onClick={async () => {
                    await api.syncUserWallet(walletAddress, normalizedBankId);
                    await loadBankData();
                    alert(`Account ${walletAddress.slice(0,6)}... successfully bound as Authorized Signer for ${meta.name || bankId.toUpperCase()}!`);
                  }}
                  className="text-[10px] bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-600/50 px-1.5 py-0.5 rounded transition cursor-pointer"
                  title="Click to register this connected wallet as this bank's signer"
                >
                  Bind as {bankId.toUpperCase()} Signer
                </button>
              )}
              <button
                onClick={handleSwitchAccount}
                className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-2 py-0.5 rounded border border-slate-700 transition cursor-pointer"
                title="Change or select a different MetaMask account for this bank"
              >
                Switch Account
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnectWallet}
              className="flex items-center space-x-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md px-3 py-1 text-xs font-medium transition cursor-pointer"
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>Connect MetaMask</span>
            </button>
          )}

          <button
            onClick={loadBankData}
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 rounded-md transition"
            title="Refresh Node Data"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      {!isAuthenticated ? (
        <main className="flex-1 p-6 max-w-md w-full mx-auto flex flex-col justify-center items-center my-auto">
          <div className="w-full bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-5">
            <div className="text-center space-y-1.5">
              <div className="w-11 h-11 bg-slate-900 text-white rounded-lg mx-auto flex items-center justify-center">
                <Lock className="w-5 h-5 text-emerald-400" />
              </div>
              <h2 className="text-base font-semibold text-slate-900">Sovereign Node Security Gate</h2>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Enter your credentials to unlock <strong>{meta.name}</strong> and bind your MetaMask signing key.
              </p>
            </div>

            {loginError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-700 flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700 block">Bank Node Identifier</label>
                <input
                  type="text"
                  value={inputUsername}
                  onChange={(e) => setInputUsername(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs font-mono font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700 block">Node Security Password</label>
                <input
                  type="password"
                  value={inputPassword}
                  onChange={(e) => setInputPassword(e.target.value)}
                  placeholder="Enter node password..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  required
                />
              </div>

              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-md text-[11px] text-slate-600 space-y-1">
                <div className="font-semibold text-slate-800 text-[11px]">Node Credentials:</div>
                <div className="flex justify-between font-mono text-[10px]">
                  <span>ID: <code className="text-slate-900">{normalizedBankId}</code></span>
                  <span>Password: <code className="text-emerald-700 font-bold">{normalizedBankId === "bank_a" ? "banka123" : normalizedBankId === "bank_b" ? "bankb123" : "bankc123"}</code></span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-medium py-2 rounded-md text-xs transition flex items-center justify-center space-x-2"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>{isLoggingIn ? "Verifying Credentials..." : "Authenticate & Unlock Portal"}</span>
              </button>
            </form>
          </div>
        </main>
      ) : (
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* Node Status Banner */}
        <div className="p-4 bg-white border border-slate-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-700 shadow-xs">
          <div className="flex items-center space-x-2.5">
            <Lock className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>
              <strong>Zero-Knowledge Firewall Active:</strong> Raw customer records ({meta.records?.toLocaleString()} samples) never leave this institution. Only 16-D continuous gradient arrays are transmitted to the coordinator.
            </span>
          </div>
          <span className="px-2.5 py-1 bg-slate-100 text-slate-800 border border-slate-200 rounded font-mono text-[11px] font-medium shrink-0">
            Registered on FraudAudit.sol
          </span>
        </div>

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="p-5 bg-white border border-slate-200 rounded-lg shadow-xs">
            <div className="text-slate-500 text-xs font-medium uppercase tracking-wider">Private Records</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{meta.records?.toLocaleString() || "0"}</div>
            <p className="mt-1 text-xs text-slate-500">{meta.dataset_name}</p>
          </div>

          <div className="p-5 bg-white border border-slate-200 rounded-lg shadow-xs">
            <div className="text-slate-500 text-xs font-medium uppercase tracking-wider">Fraud Incidents</div>
            <div className="mt-2 text-2xl font-semibold text-rose-600">{meta.fraud_count?.toLocaleString() || "0"}</div>
            <p className="mt-1 text-xs text-slate-500">Imbalance: {meta.fraud_rate_pct}% fraud</p>
          </div>

          <div className="p-5 bg-white border border-slate-200 rounded-lg shadow-xs">
            <div className="text-slate-500 text-xs font-medium uppercase tracking-wider">Universal Features</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">16 Dimensions</div>
            <p className="mt-1 text-xs text-slate-500">Standardized MLP Vector</p>
          </div>

          <div className="p-5 bg-white border border-slate-200 rounded-lg shadow-xs">
            <div className="text-slate-500 text-xs font-medium uppercase tracking-wider">On-Chain Signer</div>
            <div className="mt-2 text-xs font-mono font-semibold text-slate-900 truncate" title={bankData?.wallet_address}>
              {bankData?.wallet_address?.slice(0, 16)}...
            </div>
            <p className="mt-1 text-xs text-emerald-700 font-medium">Consortium Member</p>
          </div>
        </div>

        {/* 2-Column Grid for Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* SECTION 1: Local Model Fine-Tuning */}
          <div className="p-5 bg-white border border-slate-200 rounded-lg space-y-4 shadow-xs">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 flex items-center space-x-2">
                <Cpu className="h-4 w-4 text-slate-700" />
                <span>1. Run Local Private Fine-Tuning</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Executes PyTorch gradient descent on this bank's private records without sharing raw data. Produces updated weights and a 64-character SHA-256 fingerprint.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Local Training Epochs</label>
                <select
                  value={trainingEpochs}
                  onChange={(e) => setTrainingEpochs(parseInt(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-900 font-medium"
                >
                  <option value={1}>1 Local Epoch (Fast ~5s)</option>
                  <option value={2}>2 Local Epochs</option>
                  <option value={3}>3 Local Epochs</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Batch Size</label>
                <div className="bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-slate-700 font-mono">
                  512 samples
                </div>
              </div>
            </div>

            <button
              onClick={handleTrainLocal}
              disabled={isTrainingLocal}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs rounded-md transition flex items-center justify-center space-x-1.5"
            >
              <Play className="h-3.5 w-3.5" />
              <span>{isTrainingLocal ? "Training on Private Data..." : "Execute Local Private Training"}</span>
            </button>

            {localTrainResult && (
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-md space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900">Training Succeeded</span>
                  <span className="font-mono text-emerald-700">Loss: {localTrainResult.training_loss}</span>
                </div>
                <div className="font-mono text-[11px] text-slate-600">
                  <div>Trained on: {localTrainResult.samples_trained?.toLocaleString()} private samples</div>
                  <div className="mt-1 text-slate-900 break-all font-semibold">
                    Local SHA-256: {localTrainResult.weights_hash}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 2: Push Model Update to Blockchain */}
          <div className="p-5 bg-white border border-slate-200 rounded-lg space-y-4 shadow-xs">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 flex items-center space-x-2">
                <Layers className="h-4 w-4 text-slate-700" />
                <span>2. Push Model Update to Blockchain</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Broadcasts this bank's latest computed weights hash directly to the Solidity smart contract (<code className="font-mono">FraudAudit.sol</code>) as cryptographic proof of training.
              </p>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-md text-xs space-y-1 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Active Local Hash:</span>
                <span className="text-slate-900 font-semibold truncate max-w-xs">
                  {localTrainResult?.weights_hash || bankData?.latest_update?.weights_hash || "No local training run yet"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Target Smart Contract:</span>
                <span className="text-slate-700 truncate max-w-xs">{bankData?.contract_address}</span>
              </div>
            </div>

            <button
              onClick={handleSubmitOnChain}
              disabled={isSubmittingOnChain || (!localTrainResult && !bankData?.has_local_update)}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-medium text-xs rounded-md transition flex items-center justify-center space-x-1.5"
            >
              <FileCheck className="h-3.5 w-3.5" />
              <span>{isSubmittingOnChain ? "Registering on Blockchain..." : "Push Update Hash to Sepolia"}</span>
            </button>

            {submitResult && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-md space-y-1 text-xs text-emerald-900">
                <div className="font-semibold flex items-center space-x-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Update Hash Successfully Recorded On-Chain!</span>
                </div>
                <div className="text-[11px] font-mono mt-1 text-emerald-800">
                  Ready for coordinator aggregation and multi-bank consensus quorum.
                </div>
              </div>
            )}
          </div>

          {/* SECTION 3: Upload Custom PyTorch Checkpoint (.pt) */}
          <div className="p-5 bg-white border border-slate-200 rounded-lg space-y-4 shadow-xs">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 flex items-center space-x-2">
                <Upload className="h-4 w-4 text-slate-700" />
                <span>3. Upload Custom PyTorch Model (.pt)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Have a pre-trained fraud checkpoint? Upload the raw <code className="font-mono">.pt</code> binary. The system validates the 16-D layer tensor shapes and computes its SHA-256 fingerprint automatically.
              </p>
            </div>

            <form onSubmit={handleUploadFile} className="space-y-3">
              <input
                type="file"
                accept=".pt,.pth"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-slate-700 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-slate-100 file:text-slate-800 hover:file:bg-slate-200"
              />

              <button
                type="submit"
                disabled={isUploading || !uploadFile}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-medium text-xs rounded-md transition flex items-center justify-center space-x-1.5"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>{isUploading ? "Verifying Checkpoint Tensors..." : "Upload & Register Checkpoint"}</span>
              </button>
            </form>

            {uploadResult && (
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-md space-y-1 text-xs">
                <div className="font-semibold text-slate-900">{uploadResult.message}</div>
                <div className="font-mono text-[11px] text-slate-600 mt-1">
                  File Size: {uploadResult.file_size_kb} KB | Parameters: 3,393 weights
                </div>
              </div>
            )}
          </div>

          {/* SECTION 4: Validate Global Model & Cast Quorum Approval */}
          <div className="p-5 bg-white border border-slate-200 rounded-lg space-y-4 shadow-xs">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 flex items-center space-x-2">
                <Vote className="h-4 w-4 text-slate-700" />
                <span>4. Validate & Sign Quorum Approval</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Before approving a round, test the coordinator's candidate global model on this bank's private held-out test split. If PR-AUC passes, cast your on-chain approval vote.
              </p>
            </div>

            <div className="flex gap-2.5">
              <button
                onClick={handleValidateGlobal}
                disabled={isValidatingGlobal}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium text-xs rounded-md transition"
              >
                {isValidatingGlobal ? "Testing Test Split..." : "Test Candidate Model"}
              </button>

              <button
                onClick={handleApproveRound}
                disabled={isApproving}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-md transition flex items-center justify-center space-x-1.5"
              >
                <Vote className="h-3.5 w-3.5" />
                <span>{isApproving ? "Broadcasting..." : "Sign & Approve (MetaMask)"}</span>
              </button>
            </div>

            {validationResult && (
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-md space-y-2 text-xs">
                <div className="flex items-center justify-between font-mono">
                  <span className="font-semibold text-slate-900">PR-AUC: {validationResult.metrics?.pr_auc}</span>
                  <span className="text-slate-700">F1: {validationResult.metrics?.f1_score}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-sans font-medium ${
                    validationResult.bank_verdict === "APPROVE" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"
                  }`}>
                    {validationResult.bank_verdict}
                  </span>
                </div>
                <p className="text-slate-600 text-[11px] leading-relaxed">{validationResult.explanation}</p>
              </div>
            )}
          </div>
        </div>
      </main>
      )}
    </div>
  );
}

export default function BankPortalPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center text-xs font-mono text-slate-500">
          Loading Sovereign Bank Portal...
        </div>
      }
    >
      <BankPortalContent />
    </Suspense>
  );
}
