"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  AttestationResult,
  AttestationSimulation,
  RiskReport,
  RiskReportV2,
} from "@treasuryos/shared";
import { useWallet } from "@/components/wallet/context";

type ReportResponse = {
  report: RiskReport;
  reportHash: `0x${string}`;
  riskV2: RiskReportV2;
};

export type TreasuryMode = "analyze" | "manage";
export type StepState = "idle" | "loading" | "done" | "error";

type TreasurySessionState = {
  mode: TreasuryMode;
  setMode: (mode: TreasuryMode) => void;
  analyzedAddress: string;
  setAnalyzedAddress: (address: string) => void;
  connectedWallet: string | null;
  isOwnerVerified: boolean;
  isKeeperHubManaged: boolean;
  reportResponse: ReportResponse | null;
  setReportResponse: (response: ReportResponse | null) => void;
  riskV2: RiskReportV2 | null;
  setRiskV2: (risk: RiskReportV2 | null) => void;
  keeperHubSimulation: AttestationSimulation | null;
  setKeeperHubSimulation: (simulation: AttestationSimulation | null) => void;
  attestation: AttestationResult | null;
  setAttestation: (attestation: AttestationResult | null) => void;
  simulateState: StepState;
  setSimulateState: (state: StepState) => void;
  publishState: StepState;
  setPublishState: (state: StepState) => void;
  executionResult: {
    txHash: string;
    explorer: string;
    status: string;
    executionMode?: string;
    keeperhub?: {
      executionId: string;
      transactionHash: string;
      explorerUrl: string;
      chainId: number;
      gasUsed: string;
      sponsored: boolean;
      finalStatus: string;
      executedAt: string;
    } | null;
  } | null;
  setExecutionResult: (result: TreasurySessionState["executionResult"]) => void;
};

const TreasurySessionContext = createContext<TreasurySessionState | null>(null);
const STORAGE_KEY = "treasuryos.session.v1";

const KEEPERHUB_ORG_WALLET = "0x1DB018D456bC00810BD02E76787be42CAD7F60cF";

type StoredSession = {
  mode?: TreasuryMode;
  analyzedAddress?: string;
  reportResponse?: ReportResponse | null;
  riskV2?: RiskReportV2 | null;
  keeperHubSimulation?: AttestationSimulation | null;
  attestation?: AttestationResult | null;
  simulateState?: StepState;
  publishState?: StepState;
  executionResult?: TreasurySessionState["executionResult"];
};

export function TreasurySessionProvider({ children }: { children: ReactNode }) {
  const wallet = useWallet();
  const [mode, setMode] = useState<TreasuryMode>("analyze");
  const [analyzedAddress, setAnalyzedAddress] = useState("");
  const [reportResponse, setReportResponse] = useState<ReportResponse | null>(null);
  const [riskV2, setRiskV2] = useState<RiskReportV2 | null>(null);
  const [keeperHubSimulation, setKeeperHubSimulation] =
    useState<AttestationSimulation | null>(null);
  const [attestation, setAttestation] = useState<AttestationResult | null>(null);
  const [simulateState, setSimulateState] = useState<StepState>("idle");
  const [publishState, setPublishState] = useState<StepState>("idle");
  const [executionResult, setExecutionResult] =
    useState<TreasurySessionState["executionResult"]>(null);

  const scanned = reportResponse?.report.address ?? analyzedAddress;
  const isKeeperHubManaged = Boolean(
    scanned && scanned.toLowerCase() === KEEPERHUB_ORG_WALLET.toLowerCase()
  );

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    try {
      const stored = JSON.parse(raw) as StoredSession;
      window.queueMicrotask(() => {
        setMode(stored.mode ?? "analyze");
        setAnalyzedAddress(stored.analyzedAddress ?? "");
        setReportResponse(stored.reportResponse ?? null);
        setRiskV2(stored.riskV2 ?? null);
        setKeeperHubSimulation(stored.keeperHubSimulation ?? null);
        setAttestation(stored.attestation ?? null);
        setSimulateState(stored.simulateState ?? "idle");
        setPublishState(stored.publishState ?? "idle");
        setExecutionResult(stored.executionResult ?? null);
      });
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    const walletAddress = wallet.address;

    if (!walletAddress || mode !== "analyze") return;

    if (!scanned) {
      window.queueMicrotask(() => {
        setMode("manage");
        setAnalyzedAddress(walletAddress);
      });
      return;
    }

    if (isKeeperHubManaged || walletAddress.toLowerCase() === scanned.toLowerCase()) {
      window.queueMicrotask(() => {
        setMode("manage");
      });
    }
  }, [wallet.address, mode, scanned, isKeeperHubManaged]);

  useEffect(() => {
    if (mode !== "analyze" || !isKeeperHubManaged) return;
    window.queueMicrotask(() => {
      setMode("manage");
    });
  }, [mode, isKeeperHubManaged]);

  useEffect(() => {
    const stored: StoredSession = {
      mode,
      analyzedAddress,
      reportResponse,
      riskV2,
      keeperHubSimulation,
      attestation,
      simulateState,
      publishState,
      executionResult,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  }, [
    analyzedAddress,
    attestation,
    executionResult,
    keeperHubSimulation,
    mode,
    publishState,
    reportResponse,
    riskV2,
    simulateState,
  ]);

  const isOwnerVerified = useMemo(() => {
    return (
      isKeeperHubManaged ||
      Boolean(
        wallet.address &&
          scanned &&
          wallet.address.toLowerCase() === scanned.toLowerCase()
      )
    );
  }, [scanned, wallet.address, isKeeperHubManaged]);

  return (
    <TreasurySessionContext.Provider
      value={{
        mode,
        setMode,
        analyzedAddress,
        setAnalyzedAddress,
        connectedWallet: wallet.address,
        isOwnerVerified,
        isKeeperHubManaged,
        reportResponse,
        setReportResponse,
        riskV2,
        setRiskV2,
        keeperHubSimulation,
        setKeeperHubSimulation,
        attestation,
        setAttestation,
        simulateState,
        setSimulateState,
        publishState,
        setPublishState,
        executionResult,
        setExecutionResult,
      }}
    >
      {children}
    </TreasurySessionContext.Provider>
  );
}

export function useTreasurySession() {
  const context = useContext(TreasurySessionContext);
  if (!context) {
    throw new Error("useTreasurySession must be used within TreasurySessionProvider");
  }
  return context;
}
