import Chat from "./components/chat/Chat";
import "./App.css";
import Robot from "./assets/robot.png";

type Locale = "he" | "en";

function detectBrowserLocale(): Locale {
  if (typeof navigator !== "undefined") {
    const lang = navigator.language || navigator.languages?.[0];
    if (lang?.startsWith("he")) return "he";
  }
  return "en";
}

function App() {
  const locale = detectBrowserLocale();

  return (
    <div className="app">
      <header className="appHeader">
        <div className="appHeaderInner">
          <img className="appRobot" src={Robot} alt="Robot" />
          <h1 className="appTitle">
            {locale === "he" ? "עוזר בית מרקחת חכם" : "Pharmacist Assistant"}
          </h1>
          <div className="appHeaderSpacer" />
        </div>
      </header>

      <main className="appMain">
        <Chat />
      </main>
    </div>
  );
}

export default App;
