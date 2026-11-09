import { useState } from "react";
import { isAddress } from "viem";
import { useRill } from "../context/RillContext";
import type { Review } from "../context/RillContext";
import { useSnapshot } from "../hooks/useSnapshot";
import { chain } from "../lib/config";
import { friendlyError } from "../lib/transactions";
import { CopyButton, ErrorNotice, PageHeading } from "../components/Primitives";
import { ReviewDialog } from "../components/ReviewDialog";

export default function Setup() {
  const { wallet, contract, acceptContract, prepare, setWalletOpen } =
    useRill();
  const { data } = useSnapshot(contract, wallet.account);
  const [address, setAddress] = useState(contract);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [review, setReview] = useState<Review>();
  const share = new URL(location.href);
  share.hash = "/";
  if (data?.verified) share.searchParams.set("contract", data.verified);
  async function deploy() {
    if (!wallet.account) {
      setWalletOpen(true);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { rillBytecode } = await import("../contracts/deployment");
      setReview(await prepare({ action: "deploy", bytecode: rillBytecode }));
    } catch (error) {
      setError(friendlyError(error));
    } finally {
      setLoading(false);
    }
  }
  return (
    <>
      <PageHeading
        title="Set up Rill"
        subtitle={`Deploy the stream contract once on ${chain.name}, then share your app.`}
      />
      <div className="setup-content">
        <p>
          Connect your wallet to review the network fee and deploy. The contract
          has no administrator, protocol fee, or upgrade mechanism.
        </p>
        {data?.verified ? (
          <section className="notice setup-success">
            <h2>Rill is ready.</h2>
            <p>The deployed contract’s code matches this app.</p>
            <p className="full-address">{data.verified}</p>
            <CopyButton
              value={share.toString()}
              label="Copy shareable app URL"
            />
            <a className="primary" href={share.toString()}>
              Open Rill
            </a>
          </section>
        ) : null}
        <button
          className="primary"
          disabled={loading}
          onClick={() => void deploy()}
        >
          {loading
            ? "Estimating deployment fee…"
            : wallet.account
              ? "Review deployment"
              : "Connect wallet to deploy"}
        </button>
        <div className="setup-existing">
          <h2>Use an existing deployment</h2>
          <p className="muted small">
            Rill verifies the contract’s code before enabling payments.
          </p>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setError("");
              setLoading(true);
              try {
                if (!isAddress(address))
                  throw new Error("Enter a valid contract address.");
                await acceptContract(address);
              } catch (error) {
                setError(friendlyError(error));
              } finally {
                setLoading(false);
              }
            }}
          >
            <label htmlFor="contract-address">Contract address</label>
            <input
              id="contract-address"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="0x…"
              spellCheck={false}
            />
            <button className="secondary" disabled={loading}>
              Verify contract
            </button>
          </form>
        </div>
        {error ? <ErrorNotice message={error} /> : null}
      </div>
      {review ? (
        <ReviewDialog review={review} onClose={() => setReview(undefined)}>
          <p>
            A one-time deployment signed by your wallet. After confirmation,
            Rill checks the code and creates your shareable app link.
          </p>
        </ReviewDialog>
      ) : null}
    </>
  );
}
