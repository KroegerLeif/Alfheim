import React from "react";
import ReactDOM from "react-dom/client";
import { KcApp, KcContext } from "./KcApp";
import "./index.css";

// Keycloakify injects window.kcContext at runtime
declare global {
  interface Window {
    kcContext?: KcContext;
  }
}

const rootElement = document.getElementById("root");

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <KcApp kcContext={window.kcContext} />
    </React.StrictMode>
  );
}
