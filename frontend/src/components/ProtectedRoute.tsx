import {Navigate, Outlet} from "react-router-dom";

type ProtectedRouteProps = {
    user: string | undefined | null;
}

function ProtectedRoute(props: Readonly<ProtectedRouteProps>){

    if(props.user === undefined){
        return <h3>Loading...</h3>
    }


    return(
        props.user ? <Outlet/> : <Navigate to="/login"/>
    )

}
export default ProtectedRoute;