import './App.css'
import {Route, Routes} from "react-router-dom";
import Navigation from "@/pages/Navigation.tsx";

function App() {

  return (
    <>
        <Navigation/>
        <Routes>
            <Route path={"/"} element={null}/>
        </Routes>
    </>
  )
}

export default App
