import { Routes, Route } from "react-router-dom";
import { MainLayout } from "./components/MainLayout";
import HomePage from "./pages/HomePage";

function App() {
    return (
        <Routes>
            {/* Alle Routen innerhalb dieses Blocks bekommen die Sidebar */}
            <Route element={<MainLayout />}>
                <Route path="/" element={<HomePage />} />
                {/* Fügen Sie hier weitere Seiten hinzu, z.B. <Route path="/settings" ... /> */}
            </Route>

            {/* Hier könnten Sie Seiten ohne Sidebar definieren, z.B. eine Login-Seite */}
            {/* <Route path="/login" element={<LoginPage />} /> */}
        </Routes>
    );
}

export default App;
