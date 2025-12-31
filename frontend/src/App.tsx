import Chat from "./components/chat/Chat";
import "./App.css";
import Robot from "./assets/robot.png";
function App() {
  const locale: "he" | "en" = "he";

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
