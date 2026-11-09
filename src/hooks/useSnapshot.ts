import { useCallback, useEffect, useState } from "react";
import type { Address } from "viem";
import { readSnapshot } from "../lib/chain";
import type { Snapshot } from "../lib/chain";

export function useSnapshot(
  contract: string,
  wallet?: Address,
  page = 0,
  id?: bigint,
) {
  const key = `${contract}:${wallet}:${page}:${id}`;
  const [result, setResult] = useState<{
    key: string;
    data?: Snapshot;
    error?: string;
  }>();
  const [refreshIndex, refresh] = useState(0);
  const refreshNow = useCallback(() => refresh((value) => value + 1), []);
  useEffect(() => {
    let active = true,
      running = false;
    const update = async () => {
      if (running) return;
      running = true;
      try {
        const data = await readSnapshot(contract, wallet, page, id);
        if (active) setResult({ key, data });
      } catch (error) {
        if (active)
          setResult({
            key,
            error:
              error instanceof Error && !("shortMessage" in error)
                ? error.message
                : "Chain data is unavailable. Check your connection and retry.",
          });
      } finally {
        running = false;
      }
    };
    void update();
    const timer = setInterval(() => {
      if (!document.hidden) void update();
    }, 2000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [key, contract, wallet, page, id, refreshIndex]);
  return {
    data: result?.key === key ? result.data : undefined,
    error: result?.key === key ? result.error : undefined,
    refresh: refreshNow,
  };
}
