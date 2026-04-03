"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";

interface OnboardingStep {
  id: string;
  label: string;
  done: boolean;
  href: string;
}

const STORAGE_DISMISSED = "onboarding_dismissed";

export default function OnboardingTour() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [steps, setSteps] = useState<OnboardingStep[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checkedStorage, setCheckedStorage] = useState(false);

  const role = session?.user?.role as string | undefined;

  const fetchProgress = useCallback(async () => {
    if (!role || role === "ADMIN") return;
    try {
      const res = await fetch("/api/onboarding");
      if (res.ok) {
        const data = await res.json();
        setSteps(data.steps || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [role]);

  // Load progress
  useEffect(() => {
    fetchProgress();
  }, [fetchProgress, pathname]); // refetch on navigation

  // Check dismissed state from localStorage
  useEffect(() => {
    if (!role) return;
    const d = localStorage.getItem(STORAGE_DISMISSED + "_" + role);
    setDismissed(!!d);
    setCheckedStorage(true);
  }, [role]);

  // Listen for restart event from "?" button
  useEffect(() => {
    function handleRestart() {
      if (!role) return;
      localStorage.removeItem(STORAGE_DISMISSED + "_" + role);
      setDismissed(false);
      setCollapsed(false);
      fetchProgress();
    }
    window.addEventListener("onboarding:restart", handleRestart);
    return () => window.removeEventListener("onboarding:restart", handleRestart);
  }, [role, fetchProgress]);

  function handleDismiss() {
    if (!role) return;
    localStorage.setItem(STORAGE_DISMISSED + "_" + role, "1");
    setDismissed(true);
  }

  // Don't show on landing/login/register/admin/profile-filling pages
  if (!role || role === "ADMIN") return null;
  if (pathname === "/" || pathname === "/login" || pathname === "/register") return null;
  if (pathname.startsWith("/admin")) return null;

  // Don't show while filling profile for the first time (no sidebar)
  if (!session?.user?.profileCompleted) return null;

  if (loading || !checkedStorage || dismissed) return null;
  if (steps.length === 0) return null;

  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;

  // Auto-dismiss when all steps are done
  if (allDone) {
    return null;
  }

  const progress = Math.round((doneCount / steps.length) * 100);

  if (collapsed) {
    return (
      <div
        onClick={() => setCollapsed(false)}
        style={{
          position: "fixed",
          bottom: 24,
          right: 80,
          background: "#003092",
          color: "#fff",
          padding: "10px 20px",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          zIndex: 900,
          display: "flex",
          alignItems: "center",
          gap: 10,
          boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
        }}
      >
        <span>Начало работы</span>
        <span style={{
          background: "rgba(255,255,255,0.2)",
          padding: "2px 8px",
          fontSize: 11,
        }}>
          {doneCount}/{steps.length}
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 80,
        width: 320,
        background: "#fff",
        border: "2px solid #003092",
        boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
        zIndex: 900,
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "#003092",
          color: "#fff",
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 15 }}>Начало работы</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setCollapsed(true)}
            style={{
              background: "none",
              border: "none",
              color: "rgba(255,255,255,0.7)",
              cursor: "pointer",
              fontSize: 16,
              padding: "0 4px",
              fontFamily: "inherit",
            }}
            title="Свернуть"
          >
            —
          </button>
          <button
            onClick={handleDismiss}
            style={{
              background: "none",
              border: "none",
              color: "rgba(255,255,255,0.7)",
              cursor: "pointer",
              fontSize: 16,
              padding: "0 4px",
              fontFamily: "inherit",
            }}
            title="Скрыть"
          >
            ×
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: "#e8ecf4" }}>
        <div
          style={{
            height: "100%",
            width: `${progress}%`,
            background: "#2e7d32",
            transition: "width 0.3s ease",
          }}
        />
      </div>

      {/* Steps */}
      <div style={{ padding: "12px 0" }}>
        {steps.map((step) => (
          <a
            key={step.id}
            href={step.done ? undefined : step.href}
            onClick={step.done ? (e) => e.preventDefault() : undefined}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 20px",
              textDecoration: "none",
              color: step.done ? "#999" : "#333",
              cursor: step.done ? "default" : "pointer",
              transition: "background 0.15s",
              fontSize: 14,
            }}
            onMouseEnter={(e) => {
              if (!step.done) (e.currentTarget as HTMLElement).style.background = "#f5f5f5";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            <span
              style={{
                width: 22,
                height: 22,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                fontWeight: 700,
                ...(step.done
                  ? { background: "#2e7d32", color: "#fff" }
                  : { border: "2px solid #003092", color: "#003092" }),
              }}
            >
              {step.done ? "✓" : ""}
            </span>
            <span style={{
              flex: 1,
              textDecoration: step.done ? "line-through" : "none",
              fontWeight: step.done ? 400 : 500,
            }}>
              {step.label}
            </span>
            {!step.done && (
              <span style={{ color: "#003092", fontSize: 16 }}>→</span>
            )}
          </a>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        padding: "10px 20px",
        borderTop: "1px solid #e8ecf4",
        fontSize: 12,
        color: "#999",
        textAlign: "center",
      }}>
        {doneCount} из {steps.length} выполнено
      </div>
    </div>
  );
}
