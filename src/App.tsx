import { lazy, Suspense, useEffect, useState } from "react";
import { Shell } from "./components/Shell";
import { RillProvider } from "./context/RillContext";
import { Home } from "./pages/Home";
import { Create } from "./pages/Create";
import { Streams } from "./pages/Streams";
import { StreamDetail } from "./pages/StreamDetail";
import { Activity } from "./pages/Activity";
import { Dashboard } from "./pages/Dashboard";
import { Batch } from "./pages/Batch";
import { Request } from "./pages/Request";
import { Contacts } from "./pages/Contacts";
import { useRill } from "./context/RillContext";
const Setup = lazy(() => import("./pages/Setup"));
function Overview() {
  const { wallet } = useRill();
  return wallet.account ? <Dashboard /> : <Home />;
}
export default function App() {
  const [hash, setHash] = useState(location.hash.slice(1) || "/");
  useEffect(() => {
    const changed = () => {
      setHash(location.hash.slice(1) || "/");
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, []);
  const [route, search = ""] = hash.split("?");
  const match = route.match(/^\/streams\/(\d{1,78})$/);
  const page =
    route === "/" ? (
      <Overview />
    ) : route === "/create" ? (
      <Create
        key={hash}
        trial={new URLSearchParams(search).get("trial") === "1"}
        search={search}
      />
    ) : route === "/streams" ? (
      <Streams
        key={hash}
        initialFilter={new URLSearchParams(search).get("filter") ?? "All"}
      />
    ) : match ? (
      <StreamDetail key={match[1]} id={BigInt(match[1])} />
    ) : route === "/activity" ? (
      <Activity />
    ) : route === "/batch" ? (
      <Batch />
    ) : route === "/request" ? (
      <Request />
    ) : route === "/contacts" ? (
      <Contacts />
    ) : route === "/setup" ? (
      <Suspense fallback={<p>Loading setup…</p>}>
        <Setup />
      </Suspense>
    ) : (
      <div className="empty-state">
        <h1>Page not found</h1>
        <a href="#/">Return to Rill</a>
      </div>
    );
  return (
    <RillProvider>
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Skip to content
      </a>
      <Shell route={route}>{page}</Shell>
    </RillProvider>
  );
}
