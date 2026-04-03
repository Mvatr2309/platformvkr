"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";

interface OnboardingStep {
  id: string;
  label: string;
  done: boolean;
  href: string;
}

// Маппинг шагов → массив вариантов подсветки (первый найденный на странице — используется)
const STEP_HIGHLIGHTS: Record<string, Array<{ selector: string; hint: string }>> = {
  project: [
    { selector: '[data-onboarding="create-project"]', hint: "Нажмите сюда, чтобы создать проект" },
  ],
  team: [
    { selector: '[data-onboarding="add-team"]', hint: "Нажмите «+ Добавить», чтобы добавить участников" },
  ],
  supervisor: [
    { selector: '[data-onboarding="propose-project"]', hint: "Предложите свой проект этому руководителю" },
    { selector: '[data-onboarding="supervisor-card"]', hint: "Выберите руководителя и откройте его профиль" },
    { selector: '[data-onboarding="find-supervisor"]', hint: "Перейдите в каталог руководителей" },
  ],
  // НР
  moderation: [
    { selector: '[data-onboarding="supervisor-profile"]', hint: "Заполните профиль и отправьте на модерацию" },
  ],
  projects: [
    { selector: '[data-onboarding="supervisor-projects"]', hint: "Здесь появятся ваши проекты" },
  ],
};

const STORAGE_DISMISSED = "onboarding_dismissed";

export default function OnboardingTour() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [steps, setSteps] = useState<OnboardingStep[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checkedStorage, setCheckedStorage] = useState(false);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const [activeHint, setActiveHint] = useState<string | null>(null);
  const styleRef = useRef<HTMLStyleElement | null>(null);

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

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress, pathname]);

  useEffect(() => {
    if (!role) return;
    const d = localStorage.getItem(STORAGE_DISMISSED + "_" + role);
    setDismissed(!!d);
    setCheckedStorage(true);
  }, [role]);

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

  // Inject pulse animation CSS once
  useEffect(() => {
    if (styleRef.current) return;
    const style = document.createElement("style");
    style.textContent = `
      @keyframes onboarding-pulse {
        0% { box-shadow: 0 0 0 0 rgba(232, 55, 90, 0.5); }
        70% { box-shadow: 0 0 0 12px rgba(232, 55, 90, 0); }
        100% { box-shadow: 0 0 0 0 rgba(232, 55, 90, 0); }
      }
      [data-onboarding-active="true"] {
        outline: 2px solid #E8375A !important;
        outline-offset: 4px;
        animation: onboarding-pulse 2s infinite;
        position: relative;
        z-index: 10;
      }
    `;
    document.head.appendChild(style);
    styleRef.current = style;
    return () => {
      if (styleRef.current) {
        document.head.removeChild(styleRef.current);
        styleRef.current = null;
      }
    };
  }, []);

  // Find and highlight the active step's target element
  useEffect(() => {
    // Remove previous highlight
    document.querySelectorAll("[data-onboarding-active]").forEach((el) => {
      el.removeAttribute("data-onboarding-active");
    });
    setHighlightRect(null);
    setActiveHint(null);

    if (dismissed || collapsed || loading || !checkedStorage) return;

    const activeStep = steps.find((s) => !s.done);
    if (!activeStep) return;

    const highlights = STEP_HIGHLIGHTS[activeStep.id];
    if (!highlights) return;

    // Small delay to let page render
    const timer = setTimeout(() => {
      for (const h of highlights) {
        const el = document.querySelector(h.selector);
        if (el) {
          el.setAttribute("data-onboarding-active", "true");
          setHighlightRect(el.getBoundingClientRect());
          setActiveHint(h.hint);
          break;
        }
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [steps, pathname, dismissed, collapsed, loading, checkedStorage]);

  // Update highlight position on scroll/resize
  useEffect(() => {
    if (!highlightRect) return;

    function updateRect() {
      const el = document.querySelector("[data-onboarding-active]");
      if (el) setHighlightRect(el.getBoundingClientRect());
    }

    window.addEventListener("scroll", updateRect, true);
    window.addEventListener("resize", updateRect);
    return () => {
      window.removeEventListener("scroll", updateRect, true);
      window.removeEventListener("resize", updateRect);
    };
  }, [highlightRect]);

  function handleDismiss() {
    if (!role) return;
    localStorage.setItem(STORAGE_DISMISSED + "_" + role, "1");
    setDismissed(true);
    // Clean up highlights
    document.querySelectorAll("[data-onboarding-active]").forEach((el) => {
      el.removeAttribute("data-onboarding-active");
    });
  }

  if (!role || role === "ADMIN") return null;
  if (pathname === "/" || pathname === "/login" || pathname === "/register") return null;
  if (pathname.startsWith("/admin")) return null;
  if (!session?.user?.profileCompleted) return null;
  if (loading || !checkedStorage || dismissed) return null;
  if (steps.length === 0) return null;

  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;
  if (allDone) return null;

  const progress = Math.round((doneCount / steps.length) * 100);
  const activeStep = steps.find((s) => !s.done);

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
    <>
      {/* Hint tooltip near highlighted element */}
      {activeHint && highlightRect && (
        <div
          style={{
            position: "fixed",
            top: highlightRect.bottom + 12,
            left: highlightRect.left,
            background: "#E8375A",
            color: "#fff",
            padding: "8px 14px",
            fontSize: 13,
            fontWeight: 600,
            zIndex: 901,
            maxWidth: 280,
            boxShadow: "0 4px 12px rgba(232, 55, 90, 0.3)",
            pointerEvents: "none",
          }}
        >
          <div style={{
            position: "absolute",
            top: -6,
            left: 16,
            width: 0,
            height: 0,
            borderLeft: "6px solid transparent",
            borderRight: "6px solid transparent",
            borderBottom: "6px solid #E8375A",
          }} />
          {activeHint}
        </div>
      )}

      {/* Checklist widget */}
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
          {steps.map((step) => {
            const isActive = activeStep?.id === step.id;
            return (
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
                  background: isActive ? "rgba(232, 55, 90, 0.06)" : "transparent",
                  borderLeft: isActive ? "3px solid #E8375A" : "3px solid transparent",
                }}
                onMouseEnter={(e) => {
                  if (!step.done) (e.currentTarget as HTMLElement).style.background = isActive ? "rgba(232, 55, 90, 0.1)" : "#f5f5f5";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = isActive ? "rgba(232, 55, 90, 0.06)" : "transparent";
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
                      : isActive
                        ? { background: "#E8375A", color: "#fff" }
                        : { border: "2px solid #003092", color: "#003092" }),
                  }}
                >
                  {step.done ? "✓" : isActive ? "!" : ""}
                </span>
                <span style={{
                  flex: 1,
                  textDecoration: step.done ? "line-through" : "none",
                  fontWeight: isActive ? 600 : step.done ? 400 : 500,
                  color: isActive ? "#E8375A" : step.done ? "#999" : "#333",
                }}>
                  {step.label}
                </span>
                {!step.done && (
                  <span style={{ color: isActive ? "#E8375A" : "#003092", fontSize: 16 }}>→</span>
                )}
              </a>
            );
          })}
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
    </>
  );
}
