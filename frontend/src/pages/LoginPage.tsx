import {Button} from "@/components/ui/button.tsx";

function LoginPage() {

    function login(){
        const host:string = window.location.host ===
            "localhost:5173" ? "http://localhost:8080" : window.location.origin;
        window.open(host + "/oauth2/authorization/github", "_self")
    }

    return(
        <Button onClick={login} >Login with Github</Button>
    )
}
export default LoginPage;