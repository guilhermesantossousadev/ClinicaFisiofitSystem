import { createRoot } from "react-dom/client";
import App from "./presentation/app/App.tsx";
import "./presentation/styles/index.css";

createRoot(document.getElementById("root")!).render(<App />);
