import { useCallback, useEffect, useRef, useState } from "react";
import type { Address, EIP1193Provider } from "viem";
import { chain } from "../lib/config";
import { friendlyError } from "../lib/transactions";
import { getSaved, save } from "../lib/storage";

export type Provider = EIP1193Provider & {
  on?: (event: string, listener: (...args: any[]) => void) => void;
  removeListener?: (event: string, listener: (...args: any[]) => void) => void;
};
export type WalletEntry = {
  info: { uuid: string; name: string; rdns: string };
  provider: Provider;
};
declare global {
  interface Window {
    ethereum?: Provider;
  }
}

export function useWallet() {
  const [entries, setEntries] = useState<WalletEntry[]>([]);
  const [selected, setSelected] = useState<WalletEntry>();
  const [account, setAccount] = useState<Address>();
  const [network, setNetwork] = useState<number>();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const revision = useRef(0);
  const [version, setVersion] = useState(0);
  const invalidate = useCallback(() => {
    revision.current++;
    setVersion(revision.current);
  }, []);

  useEffect(() => {
    const announce = (event: Event) => {
      const detail = (event as CustomEvent<WalletEntry>).detail;
      if (!detail?.provider?.request || !detail.info?.uuid) return;
      setEntries((items) =>
        items.some((item) => item.provider === detail.provider)
          ? items
          : [...items.filter((item) => item.info.uuid !== "injected"), detail],
      );
    };
    window.addEventListener("eip6963:announceProvider", announce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    const fallback = window.setTimeout(() => {
      if (window.ethereum)
        setEntries((items) =>
          items.length
            ? items
            : [
                {
                  info: {
                    uuid: "injected",
                    name: "Browser wallet",
                    rdns: "injected",
                  },
                  provider: window.ethereum!,
                },
              ],
        );
    }, 200);
    return () => {
      clearTimeout(fallback);
      window.removeEventListener("eip6963:announceProvider", announce);
    };
  }, []);

  useEffect(() => {
    if (!selected) {
      const saved = getSaved("wallet");
      const previous = entries.find((entry) => entry.info.rdns === saved);
      if (previous) setSelected(previous);
    }
  }, [entries, selected]);

  useEffect(() => {
    if (!selected) return;
    let active = true;
    const provider = selected.provider;
    const sync = async () => {
      invalidate();
      const token = revision.current;
      setAccount(undefined);
      setNetwork(undefined);
      try {
        const [accounts, id] = await Promise.all([
          provider.request({ method: "eth_accounts" }),
          provider.request({ method: "eth_chainId" }),
        ]);
        if (active && token === revision.current) {
          setAccount(accounts[0]);
          setNetwork(Number(id));
        }
      } catch {
        if (active)
          setError("Your wallet is unavailable. Reconnect to continue.");
      }
    };
    const disconnected = () => {
      invalidate();
      setAccount(undefined);
      setNetwork(undefined);
    };
    provider.on?.("accountsChanged", sync);
    provider.on?.("chainChanged", sync);
    provider.on?.("disconnect", disconnected);
    void sync();
    return () => {
      active = false;
      provider.removeListener?.("accountsChanged", sync);
      provider.removeListener?.("chainChanged", sync);
      provider.removeListener?.("disconnect", disconnected);
    };
  }, [selected, invalidate]);

  async function connect(entry: WalletEntry) {
    if (connecting) return;
    setConnecting(true);
    setError("");
    invalidate();
    const token = revision.current;
    try {
      await entry.provider.request({ method: "eth_requestAccounts" });
      if (revision.current !== token) return;
      save("wallet", entry.info.rdns);
      setSelected({ ...entry });
    } catch (error) {
      setError(friendlyError(error));
    } finally {
      setConnecting(false);
    }
  }
  function disconnect() {
    invalidate();
    save("wallet", null);
    setSelected(undefined);
    setAccount(undefined);
    setNetwork(undefined);
  }
  async function switchNetwork() {
    if (!selected) return;
    setError("");
    try {
      try {
        await selected.provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: `0x${chain.id.toString(16)}` }],
        });
      } catch (error) {
        if ((error as { code?: number }).code !== 4902) throw error;
        await selected.provider.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: `0x${chain.id.toString(16)}`,
              chainName: chain.name,
              nativeCurrency: chain.nativeCurrency,
              rpcUrls: [...chain.rpcUrls.default.http],
              ...(chain.blockExplorers
                ? { blockExplorerUrls: [chain.blockExplorers.default.url] }
                : {}),
            },
          ],
        });
        await selected.provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: `0x${chain.id.toString(16)}` }],
        });
      }
      invalidate();
      const token = revision.current;
      const [accounts, id] = await Promise.all([
        selected.provider.request({ method: "eth_accounts" }),
        selected.provider.request({ method: "eth_chainId" }),
      ]);
      if (revision.current === token) {
        setAccount(accounts[0]);
        setNetwork(Number(id));
      }
    } catch (error) {
      setError(friendlyError(error));
    }
  }
  return {
    entries,
    selected,
    account,
    network,
    version,
    revision,
    connecting,
    error,
    connect,
    disconnect,
    switchNetwork,
  };
}
