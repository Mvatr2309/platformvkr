"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";

interface TourStep {
  id: string;
  page: string; // pathname where this step shows
  selector: string; // CSS selector of the target element
  title: string;
  text: string;
  position?: "top" | "bottom" | "left" | "right";
}

const STUDENT_STEPS: TourStep[] = [
  {
    id: "student-profile",
    page: "/my-projects",
    selector: 'a[href="/profile/student"]',
    title: "Шаг 1 из 4 — Профиль",
    text: "Начните с заполнения профиля: укажите магистратуру, курс и контактные данные.",
    position: "right",
  },
  {
    id: "student-create-project",
    page: "/profile/student",
    selector: 'a[href="/my-projects"]',
    title: "Шаг 2 из 4 — Мои проекты",
    text: "Отлично! Теперь перейдите в раздел «Мои проекты» и создайте свой первый проект.",
    position: "right",
  },
  {
    id: "student-add-team",
    page: "/my-projects",
    selector: 'a[href="/projects/new"]',
    title: "Шаг 2 из 4 — Создание проекта",
    text: "Нажмите «Создать проект», чтобы добавить свой проект на платформу.",
    position: "bottom",
  },
  {
    id: "student-find-supervisor",
    page: "/supervisors",
    selector: 'a[href="/supervisors"]',
    title: "Шаг 4 из 4 — Научный руководитель",
    text: "Найдите научного руководителя в каталоге. Откройте профиль и предложите ему свой проект.",
    position: "right",
  },
];

const SUPERVISOR_STEPS: TourStep[] = [
  {
    id: "supervisor-profile",
    page: "/my-projects",
    selector: 'a[href="/profile"]',
    title: "Шаг 1 из 3 — Профиль",
    text: "Заполните профиль: укажите экспертизу, магистратуры и контактные данные. После этого профиль пройдёт модерацию.",
    position: "right",
  },
  {
    id: "supervisor-projects",
    page: "/profile",
    selector: 'a[href="/my-projects"]',
    title: "Шаг 2 из 3 — Проекты",
    text: "В разделе «Мои проекты» вы увидите проекты, где вы научный руководитель, и сможете создать свой.",
    position: "right",
  },
  {
    id: "supervisor-applications",
    page: "/my-projects",
    selector: 'a[href="/applications"]',
    title: "Шаг 3 из 3 — Заявки",
    text: "Здесь будут предложения от студентов. Вы сможете принять или отклонить их.",
    position: "right",
  },
];

const STORAGE_KEY = "onboarding_step";
const STORAGE_DISMISSED = "onboarding_dismissed";

export default function OnboardingTour() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [active, setActive] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const role = session?.user?.role as string | undefined;

  const steps = role === "STUDENT" ? STUDENT_STEPS : role === "SUPERVISOR" ? SUPERVISOR_STEPS : [];

  // Check if tour should auto-start (first visit)
  useEffect(() => {
    if (!role || steps.length === 0) return;
    const dismissed = localStorage.getItem(STORAGE_DISMISSED + "_" + role);
    if (dismissed) return;

    const savedStep = parseInt(localStorage.getItem(STORAGE_KEY + "_" + role) || "0");
    setCurrentStep(savedStep);
    setActive(true);
  }, [role, steps.length]);

  // Position the highlight on the target element
  const updatePosition = useCallback(() => {
    if (!active || !steps[currentStep]) return;

    const step = steps[currentStep];
    if (pathname !== step.page) return;

    const el = document.querySelector(step.selector);
    if (el) {
      setTargetRect(el.getBoundingClientRect());
    } else {
      setTargetRect(null);
    }
  }, [active, currentStep, steps, pathname]);

  useEffect(() => {
    if (!active) return;
    // Small delay to let the page render
    const timer = setTimeout(updatePosition, 300);

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    // Observe DOM changes
    const observer = new MutationObserver(updatePosition);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      observer.disconnect();
    };
  }, [active, updatePosition]);

  function handleNext() {
    const nextStep = currentStep + 1;
    if (nextStep >= steps.length) {
      dismiss();
      return;
    }
    setCurrentStep(nextStep);
    localStorage.setItem(STORAGE_KEY + "_" + role, String(nextStep));

    // Navigate to the next step's page if different
    const nextPage = steps[nextStep].page;
    if (pathname !== nextPage) {
      router.push(nextPage);
    }
  }

  function handlePrev() {
    if (currentStep <= 0) return;
    const prevStep = currentStep - 1;
    setCurrentStep(prevStep);
    localStorage.setItem(STORAGE_KEY + "_" + role, String(prevStep));

    const prevPage = steps[prevStep].page;
    if (pathname !== prevPage) {
      router.push(prevPage);
    }
  }

  function dismiss() {
    setActive(false);
    setTargetRect(null);
    localStorage.setItem(STORAGE_DISMISSED + "_" + role, "1");
    localStorage.removeItem(STORAGE_KEY + "_" + role);
  }

  // Public: restart tour (called from help button)
  useEffect(() => {
    function handleRestart() {
      if (!role) return;
      localStorage.removeItem(STORAGE_DISMISSED + "_" + role);
      localStorage.setItem(STORAGE_KEY + "_" + role, "0");
      setCurrentStep(0);
      setActive(true);

      const firstPage = steps[0]?.page;
      if (firstPage && pathname !== firstPage) {
        router.push(firstPage);
      }
    }

    window.addEventListener("onboarding:restart", handleRestart);
    return () => window.removeEventListener("onboarding:restart", handleRestart);
  }, [role, steps, pathname, router]);

  if (!active || steps.length === 0) return null;

  const step = steps[currentStep];
  if (!step) return null;

  // If we're not on the right page, don't render
  if (pathname !== step.page) return null;

  // If target not found, show centered tooltip
  const hasTarget = !!targetRect;

  const padding = 8;
  const cutout = hasTarget
    ? {
        top: targetRect!.top - padding,
        left: targetRect!.left - padding,
        width: targetRect!.width + padding * 2,
        height: targetRect!.height + padding * 2,
      }
    : null;

  // Tooltip positioning
  const pos = step.position || "right";
  let tooltipStyle: React.CSSProperties = {};

  if (hasTarget && cutout) {
    switch (pos) {
      case "right":
        tooltipStyle = {
          position: "fixed",
          top: targetRect!.top,
          left: targetRect!.right + 16,
        };
        break;
      case "bottom":
        tooltipStyle = {
          position: "fixed",
          top: targetRect!.bottom + 16,
          left: targetRect!.left,
        };
        break;
      case "top":
        tooltipStyle = {
          position: "fixed",
          bottom: window.innerHeight - targetRect!.top + 16,
          left: targetRect!.left,
        };
        break;
      case "left":
        tooltipStyle = {
          position: "fixed",
          top: targetRect!.top,
          right: window.innerWidth - targetRect!.left + 16,
        };
        break;
    }
  } else {
    tooltipStyle = {
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
    };
  }

  return (
    <>
      {/* Overlay with cutout */}
      <div
        onClick={dismiss}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9998,
          background: "rgba(0, 0, 0, 0.5)",
          ...(hasTarget && cutout
            ? {
                clipPath: `polygon(
                  0% 0%, 0% 100%, 100% 100%, 100% 0%, 0% 0%,
                  ${cutout.left}px ${cutout.top}px,
                  ${cutout.left}px ${cutout.top + cutout.height}px,
                  ${cutout.left + cutout.width}px ${cutout.top + cutout.height}px,
                  ${cutout.left + cutout.width}px ${cutout.top}px,
                  ${cutout.left}px ${cutout.top}px
                )`,
              }
            : {}),
        }}
      />

      {/* Highlight border around target */}
      {hasTarget && cutout && (
        <div
          style={{
            position: "fixed",
            top: cutout.top,
            left: cutout.left,
            width: cutout.width,
            height: cutout.height,
            border: "2px solid #E8375A",
            zIndex: 9999,
            pointerEvents: "none",
            boxShadow: "0 0 0 4px rgba(232, 55, 90, 0.2)",
          }}
        />
      )}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          ...tooltipStyle,
          zIndex: 10000,
          background: "#fff",
          border: "2px solid #003092",
          padding: "20px 24px",
          maxWidth: 340,
          minWidth: 280,
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)",
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#003092",
            textTransform: "uppercase",
            letterSpacing: 0.5,
            marginBottom: 8,
          }}
        >
          {step.title}
        </div>
        <div
          style={{
            fontSize: 14,
            lineHeight: 1.5,
            color: "#333",
            marginBottom: 20,
          }}
        >
          {step.text}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {currentStep > 0 && (
            <button
              onClick={handlePrev}
              style={{
                padding: "8px 16px",
                background: "none",
                border: "1px solid #ddd",
                fontSize: 13,
                fontWeight: 500,
                fontFamily: "inherit",
                cursor: "pointer",
                color: "#555",
              }}
            >
              Назад
            </button>
          )}
          <button
            onClick={handleNext}
            style={{
              padding: "8px 20px",
              background: "#003092",
              color: "#fff",
              border: "none",
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            {currentStep === steps.length - 1 ? "Готово" : "Далее"}
          </button>
          <button
            onClick={dismiss}
            style={{
              marginLeft: "auto",
              padding: "8px 12px",
              background: "none",
              border: "none",
              fontSize: 12,
              color: "#999",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Пропустить
          </button>
        </div>
      </div>
    </>
  );
}
