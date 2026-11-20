"use client";

import React from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

type ToastVariant = "info" | "success" | "error";

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

type ShowToast = (message: string, variant?: ToastVariant) => void;

const ToastContext = React.createContext<ShowToast | null>(null);

const DURATION_MS: Record<ToastVariant, number> = { info: 3000, success: 3000, error: 6000 };
const ICONS = { info: Info, success: CheckCircle2, error: AlertCircle };

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const nextId = React.useRef(0);
  const timers = React.useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = React.useCallback((id: number) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const show = React.useCallback<ShowToast>((message, variant = "info") => {
    const id = ++nextId.current;
    // Keep at most 3 on screen; the oldest drops off.
    setToasts((list) => [...list.slice(-2), { id, message, variant }]);
    timers.current.set(id, setTimeout(() => dismiss(id), DURATION_MS[variant]));
  }, [dismiss]);

  React.useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-region" aria-live="polite">
        {toasts.map((t) => {
          const Icon = ICONS[t.variant];
          return (
            <div key={t.id} className={`toast toast-${t.variant}`} role={t.variant === "error" ? "alert" : "status"}>
              <Icon size={18} aria-hidden="true" className="toast-icon" />
              <span className="toast-message">{t.message}</span>
              <button type="button" className="toast-close" onClick={() => dismiss(t.id)} aria-label="ปิดการแจ้งเตือน">
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ShowToast {
  const show = React.useContext(ToastContext);
  if (!show) throw new Error("useToast must be used inside <ToastProvider>");
  return show;
}
