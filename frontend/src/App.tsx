import { Routes, Route } from "react-router-dom";
import { MainLayout } from "./components/MainLayout";
import HomePage from "./pages/HomePage";
import MainPage from "@/pages/MainPage.tsx";
import TaskPage from "@/pages/TaskPage.tsx";
import ItemPage from "@/pages/ItemPage.tsx";
import SchedulePage from "@/pages/SchedulePage.tsx";
import LoginPage from "@/pages/LoginPage.tsx";
import axios from "axios";
import {useEffect, useState} from "react";
import ProtectedRoute from "@/components/ProtectedRoute.tsx";
import LandingPage from "@/pages/LandingPage.tsx";

function App() {

    const [user,setUser] = useState<string | undefined | null>(undefined);

    const loadUser = () => {
        axios.get("/api/auth")
            .then((response) => {
                setUser(response.data);
            })
            .catch((error) => {
                console.log(error);
                setUser(null);
            }
            )
    }

    useEffect(() => {
        loadUser()
    }, []);

    return (
        <Routes>
            <Route element={<ProtectedRoute user={user}/>}>
                <Route element={<MainLayout/>} >
                    <Route path={"/"} element={<MainPage/>} />
                    <Route path={"/home"} element={<HomePage />} />
                    <Route path={"/task"} element={<TaskPage/>} />
                    <Route path={"/item"} element={<ItemPage/>} />
                    <Route path={"/schedule"} element={<SchedulePage/>} />
                </Route>
            </Route>

            <Route path={"/login"} element={<LoginPage/>} />

            <Route path={"/landingPage"} element={<LandingPage/>}/>

        </Routes>
    );
}

export default App;
