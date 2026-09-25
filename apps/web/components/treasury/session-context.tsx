"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { RiskReport, RiskReportV2 } from "@treasuryos/shared";
import { useWallet } from "@/components/wallet/context";

type ReportResponse = {
  report: RiskReport;
  reportHash: `0x${string}`;
  riskV2: RiskReportV2;
};

export type TreasuryMode = "analyze" | "manage";

type TreasurySessionState = {
  mode: TreasuryMode;
  setMode: (mode: TreasuryMode) => void;
  analyzedAddress: string;
  setAnalyzedAddress: (address: string) => void;
  connectedWallet: string | null;
  isOwnerVerified: boolean;
  reportResponse: ReportResponse | null;
  setReportResponse: (response: ReportResponse | null) => void;
  riskV2: RiskReportV2 | null;
  setRiskV2: (risk: RiskReportV2 | null) => void;
};

const TreasurySessionContext = createContext<TreasurySessionState | null>(null);
const STORAGE_KEY = "treasuryos.session.v1";

type StoredSession = {
  mode?: TreasuryMode;
  analyzedAddress?: string;
  reportResponse?: ReportResponse | null;
  riskV2?: RiskReportV2 | null;
};

export function TreasurySessionProvider({ children }: { children: ReactNode }) {
  const wallet = useWallet();
  const [mode, setMode] = useState<TreasuryMode>("analyze");
  const [analyzedAddress, setAnalyzedAddress] = useState("");
  const [reportResponse, setReportResponse] = useState<ReportResponse | null>(null);
  const [riskV2, setRiskV2] = useState<RiskReportV2 | null>(null);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      window.queueMicrotask(() => setRestored(true));
      return;
    }

    try {
      const stored = JSON.parse(raw) as StoredSession;
      window.queueMicrotask(() => {
        setMode(stored.mode ?? "analyze");
        setAnalyzedAddress(stored.analyzedAddress ?? "");
        setReportResponse(stored.reportResponse ?? null);
        setRiskV2(stored.riskV2 ?? null);
        setRestored(true);
      });
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
      window.queueMicrotask(() => setRestored(true));
    }
  }, []);

  useEffect(() => {
    const walletAddress = wallet.address;

    if (!walletAddress || mode !== "analyze") return;

    const scanned = reportResponse?.report.address ?? analyzedAddress;

    if (!scanned) {
      window.queueMicrotask(() => {
        setMode("manage");
        setAnalyzedAddress(walletAddress);
      });
      return;
    }

    if (walletAddress.toLowerCase() === scanned.toLowerCase()) {
      window.queueMicrotask(() => {
        setMode("manage");
      });
    }
  }, [wallet.address, mode, analyzedAddress, reportResponse?.report.address]);

  useEffect(() => {
    if (!restored) return;
    const stored: StoredSession = {
      mode,
      analyzedAddress,
      reportResponse,
      riskV2,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  }, [
    analyzedAddress,
    mode,
    reportResponse,
    riskV2,
    restored,
  ]);

  const isOwnerVerified = useMemo(() => {
    const scanned = reportResponse?.report.address ?? analyzedAddress;
    return Boolean(
      wallet.address &&
        scanned &&
        wallet.address.toLowerCase() === scanned.toLowerCase()
    );
  }, [analyzedAddress, reportResponse?.report.address, wallet.address]);

  return (
    <TreasurySessionContext.Provider
      value={{
        mode,
        setMode,
        analyzedAddress,
        setAnalyzedAddress,
        connectedWallet: wallet.address,
        isOwnerVerified,
        reportResponse,
        setReportResponse,
        riskV2,
        setRiskV2,
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
