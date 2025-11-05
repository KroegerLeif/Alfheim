import {Button} from "@/components/ui/button.tsx";

function LandingPage(){

    function openLoginPage(){
        const host:string = window.location.origin;
        window.open(host + "/login", "_self")
    }

    return(
        <>
            <h1>This is The Landing Page</h1>
            <p>Hier kommt noch ne Bescheriebung der Software und so weiter Hin</p>
            <Button onClick={openLoginPage} variant={"outline"}>Login in</Button>
        </>
    )

}export default LandingPage;