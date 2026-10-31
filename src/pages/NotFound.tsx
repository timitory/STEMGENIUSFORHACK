import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <div className="w-full max-w-md text-center p-6 sm:p-12">
        <h1 className="mb-4 text-4xl sm:text-5xl md:text-6xl font-extrabold">404</h1>
        <p className="mb-6 text-lg sm:text-xl text-muted-foreground">Oops! Page not found</p>
        <Link to="/" className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-95">
          Return to Home
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
