import './App.css'
import {Route, Routes} from "react-router-dom";
import Navigation from "@/pages/Navigation.tsx";
import Home_page from "@/pages/Home_page.tsx";

function App() {

  return (
    <>
        <Navigation/>
        <Routes>
            <Route path={"/"} element={null}/>
            <Route path={"/home"} element={<Home_page/>}/>
        </Routes>
    </>
  )
}

export default App
