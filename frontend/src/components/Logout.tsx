import { Button } from "./ui/button";

function Logout(){

    function logout(){
        const host:string = window.location.host ===
        "localhost:5173" ? "http://localhost:8080" : window.location.origin;
        window.open(host + "/logout", "_self")
    }

    return(
        <Button onClick={logout} >Logout</Button>
    )

}export default Logout;