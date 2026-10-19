import ReactDOM from "react-dom/client";
import "./index.css";
import "./i18n";
import App from "./App";
import { startPwa } from "./lib/pwa";
import { watchViewport } from "./lib/viewport";

// Before the first render, so an install prompt the browser offers early isn't missed.
startPwa();
watchViewport();

const rootElement = document.getElementById("root");
if (!rootElement) {
	throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(<App />);
