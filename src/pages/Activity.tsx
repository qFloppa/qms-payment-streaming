import { useRill } from "../context/RillContext";
import { useSnapshot } from "../hooks/useSnapshot";
import { ActivityFeed } from "../components/ActivityFeed";
import {
  ContractNotice,
  ErrorNotice,
  PageHeading,
} from "../components/Primitives";
export function Activity() {
  const { wallet, contract, setWalletOpen } = useRill();
  const { data, error, refresh } = useSnapshot(contract, wallet.account);
  return (
    <>
      <PageHeading
        title="Your activity"
        subtitle="Every payment has a paper trail. This one is onchain."
      />
      {!wallet.account ? (
        <div className="empty-state">
          <p>Connect your wallet to see your transactions.</p>
          <button className="primary" onClick={() => setWalletOpen(true)}>
            Connect wallet
          </button>
        </div>
      ) : !contract ? (
        <ContractNotice />
      ) : error ? (
        <ErrorNotice message={error} retry={refresh} />
      ) : data?.verified ? (
        <ActivityFeed
          contract={data.verified}
          block={data.blockNumber}
          wallet={wallet.account}
        />
      ) : (
        <p className="loading" role="status">Reading activity…</p>
      )}
    </>
  );
}
