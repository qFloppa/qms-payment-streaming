import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "./styles/shell.css";
import "./styles/pages.css";
import "./styles/dialogs.css";
import "./styles/workspace.css";
import "./styles/home.css";
import "./styles/motion.css";
import App from "./App";
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
