import { Routes, Route } from "react-router-dom";
import { MainLayout } from "./components/MainLayout";
import HomePage from "./pages/HomePage";
import MainPage from "@/pages/MainPage.tsx";
import TaskPage from "@/pages/TaskPage.tsx";

function App() {
    return (
        <Routes>
            {/* Alle Routen innerhalb dieses Blocks bekommen die Sidebar */}
            <Route element={<MainLayout/>} >
                <Route path="/" element={<MainPage/>} />
                <Route path="/home" element={<HomePage />} />
                <Route path={"/task"} element={<TaskPage/>} />
            </Route>

            {/* Hier könnten Sie Seiten ohne Sidebar definieren, z.B. eine Login-Seite */}
            {/* <Route path="/login" element={<LoginPage />} /> */}
        </Routes>
    );
}

export default App;
