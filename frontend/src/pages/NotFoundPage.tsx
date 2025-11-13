import { Home, Search, ArrowLeft, MapPin } from "lucide-react";
import {Button} from "@/components/ui/button.tsx";

interface NotFoundProps {
    onGoHome?: () => void;
    onGoBack?: () => void;
}

export function NotFound({ onGoHome, onGoBack }: NotFoundProps) {
    return (
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
            <div className="max-w-2xl w-full text-center space-y-8">
                {/* Icon and 404 */}
                <div className="space-y-4">
                    <div className="flex items-center justify-center">
                        <div className="relative">
                            {/* Large 404 Text */}
                            <div className="text-[120px] md:text-[180px] font-bold text-muted-foreground/20 select-none">
                                404
                            </div>
                            {/* Icon Overlay */}
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="flex h-20 w-20 md:h-24 md:w-24 items-center justify-center rounded-full bg-primary/10 border-4 border-primary/20">
                                    <MapPin className="h-10 w-10 md:h-12 md:w-12 text-primary" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Title */}
                    <div className="space-y-2">
                        <h1 className="text-3xl md:text-4xl">
                            Page Not Found
                        </h1>
                        <p className="text-lg text-muted-foreground max-w-md mx-auto">
                            Looks like you've wandered off the maintenance schedule. This page doesn't exist.
                        </p>
                    </div>
                </div>

                {/* Suggestions */}
                <div className="bg-muted/30 border border-border rounded-lg p-6 space-y-4">
                    <div className="flex items-start gap-3">
                        <Search className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                        <div className="text-left space-y-1">
                            <h3 className="text-sm">What you can do:</h3>
                            <ul className="text-sm text-muted-foreground space-y-1">
                                <li>• Check the URL for typos</li>
                                <li>• Return to the dashboard</li>
                                <li>• Use the navigation menu to find what you need</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    {onGoBack && (
                        <Button
                            variant="outline"
                            size="lg"
                            onClick={onGoBack}
                            className="gap-2"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Go Back
                        </Button>
                    )}
                    {onGoHome && (
                        <Button
                            size="lg"
                            onClick={onGoHome}
                            className="gap-2"
                        >
                            <Home className="h-4 w-4" />
                            Back to Dashboard
                        </Button>
                    )}
                </div>

                {/* Additional Help */}
                <div className="pt-8 border-t border-border">
                    <p className="text-sm text-muted-foreground">
                        Need help? Check your{" "}
                        <button className="text-primary hover:underline">
                            maintenance schedule
                        </button>{" "}
                        or{" "}
                        <button className="text-primary hover:underline">
                            contact support
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
}
