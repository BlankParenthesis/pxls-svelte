import "./reset.css";
import "./global.css";
import "./ui.css";
import "./theme.css";
import App from "./components/App.svelte";

const app = new App({
	target: document.body!,
});

export default app;
