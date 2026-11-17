"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !window.location.protocol.startsWith("http")) return;
    let registration: ServiceWorkerRegistration | undefined;
    let updateTimer: number | undefined;
    const update = () => { if (navigator.onLine) void registration?.update().catch(() => undefined); };
    void navigator.serviceWorker.register("/service-worker.js", { scope: "/", updateViaCache: "none" })
      .then((result) => { registration = result; updateTimer = window.setInterval(update, 60 * 60 * 1000); })
      .catch(() => undefined);
    window.addEventListener("online", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      if (updateTimer) window.clearInterval(updateTimer);
      window.removeEventListener("online", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return null;
}
