import { lazy, Suspense, useEffect, useState } from "react";
import { Shell } from "./components/Shell";
import { RillProvider } from "./context/RillContext";
import { Home } from "./pages/Home";
import { Create } from "./pages/Create";
import { Streams } from "./pages/Streams";
import { StreamDetail } from "./pages/StreamDetail";
import { Activity } from "./pages/Activity";
const Setup = lazy(() => import("./pages/Setup"));
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
      <Home />
    ) : route === "/create" ? (
      <Create
        key={hash}
        trial={new URLSearchParams(search).get("trial") === "1"}
      />
    ) : route === "/streams" ? (
      <Streams />
    ) : match ? (
      <StreamDetail key={match[1]} id={BigInt(match[1])} />
    ) : route === "/activity" ? (
      <Activity />
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
