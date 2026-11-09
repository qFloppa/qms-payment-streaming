import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ArrowUpRight, Check, Copy, X } from "lucide-react";
import { explorerUrl } from "../lib/config";
import { shortAddress } from "../lib/domain";

export function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = dialog.current!;
    element.showModal();
    return () => {
      element.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <button
        className="icon-button dialog-close"
        onClick={onClose}
        aria-label="Close dialog"
      >
        <X size={19} />
      </button>
      <h2 id={titleId}>{title}</h2>
      {children}
    </dialog>
  );
}
export function CopyButton({
  value,
  label,
  compact = false,
}: {
  value: string;
  label?: string;
  compact?: boolean;
}) {
  const [state, setState] = useState("");
  return (
    <button
      type="button"
      className={`copy-button ${compact ? "compact" : ""}`}
      title={value}
      aria-label={label ? `${label}: ${value}` : `Copy ${value}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setState("Copied");
        } catch {
          setState("Select and copy the address below");
        }
      }}
    >
      {label ?? shortAddress(value)}
      {state === "Copied" ? <Check size={14} /> : <Copy size={14} />}
      <span
        className={state === "Copied" ? "sr-only" : "copy-status"}
        role="status"
      >
        {state}
      </span>
    </button>
  );
}
export function ReceiptLink({ hash }: { hash: string }) {
  const url = explorerUrl("tx", hash);
  return url ? (
    <a className="text-link" href={url} target="_blank" rel="noreferrer">
      View transaction <ArrowUpRight size={15} />
    </a>
  ) : (
    <CopyButton value={hash} label="Copy transaction hash" />
  );
}
export function ErrorNotice({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="notice error" role="alert">
      <span>{message}</span>
      {retry ? <button onClick={retry}>Try again</button> : null}
    </div>
  );
}
export function ContractNotice() {
  return (
    <div className="notice">
      Rill needs a deployed stream contract on this network.{" "}
      <a href="#/setup">
        Set up Rill <ArrowUpRight size={14} />
      </a>
    </div>
  );
}
export function PageHeading({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {children}
    </div>
  );
}
