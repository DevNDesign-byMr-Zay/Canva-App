import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "../src/intents/design_editor/app";

const root = document.getElementById("root");
if (!root) throw new Error("E2E root element is missing");

createRoot(root).render(<App />);
