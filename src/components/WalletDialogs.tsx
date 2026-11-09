import { ArrowUpRight, Wallet } from "lucide-react";
import { useRill } from "../context/RillContext";
import { chain, faucetUrl } from "../lib/config";
import { Dialog, CopyButton, ErrorNotice } from "./Primitives";

export function WalletDialogs() {
  const { wallet, walletOpen, setWalletOpen, faucetOpen, setFaucetOpen } =
    useRill();
  return (
    <>
      {walletOpen ? (
        <Dialog
          title={wallet.account ? "Your wallet" : "Connect your wallet"}
          onClose={() => setWalletOpen(false)}
        >
          {wallet.account ? (
            <>
              <p className="muted">
                Connected to {wallet.selected?.info.name}.
              </p>
              <p className="full-address">{wallet.account}</p>
              <CopyButton value={wallet.account} label="Copy wallet address" />
              <div className="dialog-rule" />
              <p>
                {wallet.network === chain.id
                  ? chain.name
                  : "Your wallet is on a different network."}
              </p>
              {wallet.network !== chain.id ? (
                <button
                  className="primary"
                  onClick={() => void wallet.switchNetwork()}
                >
                  Switch to {chain.name}
                </button>
              ) : null}
              <button
                className="secondary full"
                onClick={() => {
                  wallet.disconnect();
                  setWalletOpen(false);
                }}
              >
                Disconnect wallet
              </button>
            </>
          ) : (
            <>
              <p className="muted">
                Choose an EVM wallet to start your stream.
              </p>
              {wallet.entries.map((entry) => (
                <button
                  className="wallet-option"
                  key={entry.info.uuid}
                  disabled={wallet.connecting}
                  onClick={() => void wallet.connect(entry)}
                >
                  <Wallet size={20} />
                  <span>{entry.info.name}</span>
                  <ArrowUpRight size={18} />
                </button>
              ))}
              {wallet.entries.length === 0 ? (
                <div className="notice">
                  No browser wallet found. Open Rill in an EVM wallet’s browser,
                  or install a browser wallet and reload this page.
                </div>
              ) : null}
              {wallet.connecting ? (
                <p role="status">Waiting for your wallet…</p>
              ) : null}
            </>
          )}
          {wallet.error ? <ErrorNotice message={wallet.error} /> : null}
          {wallet.account ? (
            <button
              className="primary full"
              onClick={() => setWalletOpen(false)}
            >
              Continue
            </button>
          ) : null}
        </Dialog>
      ) : null}
      {faucetOpen ? (
        <Dialog title="Get test QMS" onClose={() => setFaucetOpen(false)}>
          <p className="muted">
            The one-minute stream needs 1 QMS plus a small network fee. Copy
            your wallet address, then visit the official faucet.
          </p>
          {wallet.account ? (
            <>
              <p className="full-address">{wallet.account}</p>
              <CopyButton value={wallet.account} label="Copy wallet address" />
            </>
          ) : (
            <button
              className="secondary"
              onClick={() => {
                setFaucetOpen(false);
                setWalletOpen(true);
              }}
            >
              Connect wallet
            </button>
          )}
          <a
            className="primary full"
            href={faucetUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open faucet <ArrowUpRight size={17} />
          </a>
          <p className="small muted">
            Complete the faucet’s verification in the new tab. Rill refreshes
            your balance when you return.
          </p>
        </Dialog>
      ) : null}
    </>
  );
}
