"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function NavigationProgress() {
  const pathname = usePathname();
  const [width, setWidth]     = useState(0);
  const [visible, setVisible] = useState(false);
  const [done, setDone]       = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedRef = useRef(false);

  function clearTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function start() {
    if (startedRef.current) return;
    startedRef.current = true;
    clearTimer();
    setDone(false);
    setVisible(true);
    setWidth(10);
    timerRef.current = setInterval(() => {
      setWidth((w) => {
        if (w >= 80) { clearTimer(); return w; }
        // slow-down as it approaches 80%
        return w + (80 - w) * 0.08;
      });
    }, 200);
  }

  function complete() {
    clearTimer();
    startedRef.current = false;
    setWidth(100);
    setDone(true);
    setTimeout(() => {
      setVisible(false);
      setWidth(0);
      setDone(false);
    }, 350);
  }

  // Intercept internal link clicks to start the bar
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const anchor = (e.target as Element).closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("http://") ||
        href.startsWith("https://") ||
        href.startsWith("mailto:") ||
        anchor.getAttribute("target") === "_blank" ||
        anchor.getAttribute("download") != null
      ) return;
      start();
    }
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Complete when route finishes loading
  useEffect(() => {
    complete();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!visible) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] h-[2.5px] pointer-events-none"
      aria-hidden
    >
      <div
        className="h-full bg-gray-900"
        style={{
          width: `${width}%`,
          transition: done
            ? "width 200ms ease-out, opacity 200ms ease-out"
            : "width 200ms linear",
          boxShadow: "0 0 8px rgba(17,24,39,0.6)",
        }}
      />
    </div>
  );
}
