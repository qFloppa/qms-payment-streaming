import { useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  ArrowLeftRight,
  Clock3,
  Menu,
  Wallet,
  X,
} from "lucide-react";
import { useRill } from "../context/RillContext";
import { chain } from "../lib/config";
import { shortAddress } from "../lib/domain";
import { Dialog, ReceiptLink } from "./Primitives";
import { WalletDialogs } from "./WalletDialogs";

export function Shell({
  route,
  children,
}: {
  route: string;
  children: ReactNode;
}) {
  const {
    wallet,
    setWalletOpen,
    setFaucetOpen,
    feedback,
    setFeedback,
    pending,
    storageError,
  } = useRill();
  const [menu, setMenu] = useState(false);
  const [help, setHelp] = useState(false);
  const activity = route === "/activity";
  const navigation = (
    <nav aria-label="Main navigation">
      <a
        className={!activity ? "selected" : ""}
        href={wallet.account ? "#/streams" : "#/"}
        onClick={() => setMenu(false)}
      >
        <ArrowLeftRight size={18} />
        Streams
      </a>
      <a
        className={activity ? "selected" : ""}
        href="#/activity"
        onClick={() => setMenu(false)}
      >
        <Clock3 size={18} />
        Activity
      </a>
    </nav>
  );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="wordmark" href="#/">
          rill
        </a>
        <span className="brand-caption">Payment streams</span>
        {navigation}
        <div className="rail-bottom">
          <button className="text-button" onClick={() => setHelp(true)}>
            How streams work
          </button>
          <span className="network">
            <i />
            {chain.name}
          </span>
        </div>
      </aside>
      <div className="app-main">
        <header className="app-header">
          <a className="wordmark mobile-logo" href="#/">
            rill
          </a>
          <a className="breadcrumb" href="#/streams">
            {activity ? "Activity" : route === "/setup" ? "Setup" : "Streams"}
          </a>
          <div className="header-actions">
            <button
              className="secondary wallet-button"
              onClick={() => setWalletOpen(true)}
            >
              {wallet.account ? (
                <>
                  <i className="status-dot" />
                  {shortAddress(wallet.account)}
                </>
              ) : (
                <>
                  <Wallet size={16} />
                  Connect wallet
                </>
              )}
            </button>
            <button
              className="icon-button menu-toggle"
              aria-label="Open navigation"
              aria-expanded={menu}
              onClick={() => setMenu((value) => !value)}
            >
              {menu ? <X size={19} /> : <Menu size={19} />}
            </button>
          </div>
        </header>
        {menu ? <div className="mobile-nav">{navigation}</div> : null}
        <main id="main-content" tabIndex={-1}>
          {route.startsWith("/streams/") ? (
            <a className="mobile-back" href="#/streams">
              <ArrowLeft size={15} />
              Streams
            </a>
          ) : null}
          {wallet.account && wallet.network !== chain.id ? (
            <div className="notice">
              Switch your wallet to {chain.name} to continue.
              <button onClick={() => void wallet.switchNetwork()}>
                Switch network
              </button>
              {wallet.error ? <span role="alert">{wallet.error}</span> : null}
            </div>
          ) : null}
          {storageError ? (
            <p className="notice error" role="alert">
              {storageError}
            </p>
          ) : null}
          {feedback ? (
            <div
              className={`notice transaction-notice ${feedback.state === "failed" ? "error" : ""}`}
              role={feedback.state === "failed" ? "alert" : "status"}
            >
              <span>{feedback.message}</span>
              {feedback.hash ? <ReceiptLink hash={feedback.hash} /> : null}
              <button
                className="icon-button"
                aria-label="Dismiss notification"
                onClick={() => setFeedback(undefined)}
              >
                <X size={15} />
              </button>
            </div>
          ) : null}
          {pending
            .filter(
              (tx) => tx.chainId === chain.id && tx.hash !== feedback?.hash,
            )
            .map((tx) => (
              <div className="notice" role="status" key={tx.hash}>
                <span>
                  {tx.action === "deploy" ? "Deployment" : "Transaction"}{" "}
                  pending. Waiting for a block confirmation.
                </span>
                <ReceiptLink hash={tx.hash} />
              </div>
            ))}
          {children}
        </main>
        <footer>
          <span>
            {route === "/"
              ? "Test tokens have no monetary value. Network fees apply."
              : `${chain.name} · Test tokens have no monetary value.`}
          </span>
          {route === "/" ? (
            <button className="text-button" onClick={() => setFaucetOpen(true)}>
              Get test QMS
            </button>
          ) : null}
        </footer>
      </div>
      <WalletDialogs />
      {help ? (
        <Dialog
          title="A payment. A little at a time."
          onClose={() => setHelp(false)}
        >
          <p>
            Fund a payment once. QMS stays in the stream contract and unlocks
            for the recipient as time passes.
          </p>
          <p>
            The recipient can withdraw available QMS whenever they’re ready. The
            sender can cancel before the stream ends: unlocked QMS stays with
            the recipient, and the rest returns to the sender.
          </p>
          <p className="muted">
            The one-minute trial sends 1 test QMS to your own wallet over 60
            seconds. Network fees are paid separately.
          </p>
          <a
            className="primary full"
            href="#/create?trial=1"
            onClick={() => setHelp(false)}
          >
            Try a 1-minute stream
          </a>
        </Dialog>
      ) : null}
    </div>
  );
}
