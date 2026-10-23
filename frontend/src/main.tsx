import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { AuthGate } from "./components/AuthGate";
import "./styles.css";

const root = createRoot(document.getElementById("root")!);

if (import.meta.env.VITE_APP === "1") {
  // Android app (see api.ts APP); a constant here, so web builds drop this branch.
  // The phone shows the desktop layout as-is, scaled to fit the screen width (see .app in styles.css).
  const DESIGN_WIDTH = 1360;
  document.documentElement.classList.add("app");
  const fit = () => {
    document.documentElement.style.setProperty("--app-zoom", String(Math.min(1, window.innerWidth / DESIGN_WIDTH)));
  };
  fit();
  window.addEventListener("resize", fit);
  import("./mobile/MobileApp").then(({ MobileApp }) =>
    root.render(
      <StrictMode>
        <MobileApp />
      </StrictMode>,
    ),
  );
} else {
  root.render(
    <StrictMode>
      <AuthGate>{(signOut) => <App onSignOut={signOut} />}</AuthGate>
    </StrictMode>,
  );
}
