import {Button} from "@/components/ui/button.tsx";
import {Calendar, CheckCircle2, Home, Shield, Users, Wrench} from "lucide-react";

function LandingPage(){

    function openLoginPage(){
        const host:string = window.location.origin;
        window.open(host + "/login", "_self")
    }

    const features = [
        {
            icon: CheckCircle2,
            title: "Task Management",
            description: "Manage all maintenance tasks for your properties in one place"
        },
        {
            icon: Home,
            title: "Multiple Homes",
            description: "Organize any number of properties and their items"
        },
        {
            icon: Calendar,
            title: "Scheduling",
            description: "Plan maintenance and keep track of all appointments"
        },
        {
            icon: Users,
            title: "Household Members",
            description: "Coordinate tasks with your family or roommates"
        },
        {
            icon: Wrench,
            title: "Contractor Contacts",
            description: "Store all important contacts for craftsmen and service providers"
        },
        {
            icon: Shield,
            title: "Energy Efficiency",
            description: "Track the condition of your items with EU energy labels"
        }
    ];

    return (
        <div className="min-h-screen bg-background text-foreground">
            {/* Header */}
            <header className="border-b border-border">
                <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                            <Home className="h-6 w-6" />
                        </div>
                        <span className="text-xl">Alfheim</span>
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <section className="container mx-auto px-4 py-16 md:py-24">
                <div className="max-w-3xl mx-auto text-center">
                    <h1 className="text-4xl md:text-5xl lg:text-6xl mb-6">
                        Your Home<br />Under Your Control
                    </h1>
                    <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
                        Alfheim helps you plan maintenance tasks, manage items,
                        and coordinate with household members – all in one place.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Button
                            size="lg"
                            onClick={openLoginPage}
                        >
                            Get Started
                        </Button>
                        <Button
                            variant="outline"
                            size="lg"
                            onClick={() => {
                                document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
                            }}
                        >
                            Learn More
                        </Button>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="border-t border-border bg-muted/30">
                <div className="container mx-auto px-4 py-16 md:py-24">
                    <div className="max-w-2xl mx-auto text-center mb-12">
                        <h2 className="text-3xl md:text-4xl mb-4">
                            Everything You Need
                        </h2>
                        <p className="text-muted-foreground">
                            A comprehensive solution for managing your properties and maintenance tasks
                        </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
                        {features.map((feature, index) => (
                            <div
                                key={index}
                                className="bg-card border border-border rounded-lg p-6 hover:border-primary/50 transition-colors"
                            >
                                <div className="flex items-start gap-4">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                        <feature.icon className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h3 className="mb-2">{feature.title}</h3>
                                        <p className="text-sm text-muted-foreground">
                                            {feature.description}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="border-t border-border">
                <div className="container mx-auto px-4 py-16 md:py-24">
                    <div className="max-w-3xl mx-auto text-center">
                        <h2 className="text-3xl md:text-4xl mb-4">
                            Ready to Get Started?
                        </h2>
                        <p className="text-lg text-muted-foreground mb-8">
                            Start today and keep your home organized and well-maintained.
                        </p>
                        <Button onClick={openLoginPage}>Get Started</Button>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-border bg-muted/30">
                <div className="container mx-auto px-4 py-8">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                                <Home className="h-5 w-5" />
                            </div>
                            <span>Alfheim</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            © 2025 Alfheim. Maintenance planning for homeowners.
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );

}export default LandingPage;