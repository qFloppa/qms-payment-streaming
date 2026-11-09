import { useEffect, useMemo, useState } from "react";
import { isAddress, zeroAddress } from "viem";
import { chain } from "../lib/config";
import { getSaved, save } from "../lib/storage";
import { validateLabel } from "../lib/workspace";

export type Contact = { address: string; name: string };
export function useContacts(wallet?: string) {
  const key = `contacts:${chain.id}:${wallet?.toLowerCase() ?? "disconnected"}`;
  const [version, update] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    const refresh = () => update((value) => value + 1);
    window.addEventListener("storage", refresh);
    window.addEventListener("rill-contacts", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("rill-contacts", refresh);
    };
  }, []);
  const contacts = useMemo((): Contact[] => {
    if (!wallet) return [];
    try {
      const values: unknown = JSON.parse(getSaved(key) ?? "[]");
      return Array.isArray(values)
        ? values.filter(
            (item): item is Contact =>
              item &&
              typeof item.address === "string" &&
              isAddress(item.address) &&
              typeof item.name === "string" &&
              item.name.length <= 80,
          )
        : [];
    } catch {
      return [];
    }
  }, [key, version, wallet]);
  function write(next: Contact[]) {
    if (!wallet) throw new Error("Connect your wallet to save contacts.");
    if (!save(key, JSON.stringify(next))) {
      setError(
        "Contacts could not be saved in this browser. Check your browser’s storage settings.",
      );
      return false;
    }
    setError("");
    window.dispatchEvent(new Event("rill-contacts"));
    return true;
  }
  function upsert(address: string, name: string) {
    address = address.trim();
    name = validateLabel(name);
    if (!isAddress(address) || address.toLowerCase() === zeroAddress)
      throw new Error("Enter a valid, nonzero wallet address.");
    if (!name) throw new Error("Give this contact a name.");
    return write(
      [
        ...contacts.filter(
          (item) => item.address.toLowerCase() !== address.toLowerCase(),
        ),
        { address, name },
      ].sort((a, b) => a.name.localeCompare(b.name)),
    );
  }
  return {
    contacts,
    error,
    upsert,
    remove: (address: string) =>
      write(contacts.filter((item) => item.address !== address)),
  };
}
