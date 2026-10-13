import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { ModalProvider } from "./contexts/ModalContext";
import "./index.css";

const rootElement = document.getElementById("root");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ModalProvider>
        <App />
      </ModalProvider>
    </React.StrictMode>
  );
}
