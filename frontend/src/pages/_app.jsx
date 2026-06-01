import "../styles/globals.css";
import AppLayout from "../components/AppLayout";
import { Toaster } from "react-hot-toast";

const NO_LAYOUT_ROUTES = ["/login", "/", "/forgot-password", "/reset-password", "/register"];

export default function App({ Component, pageProps, router }) {
  const useLayout = !NO_LAYOUT_ROUTES.includes(router.pathname);

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          style: { background: "#1e2230", color: "#e8eaf2", border: "1px solid #2a3048", fontSize: 13 },
          success: { iconTheme: { primary: "#22c984", secondary: "#1e2230" } },
          error: { iconTheme: { primary: "#e8425a", secondary: "#1e2230" } },
        }}
      />
      {useLayout ? (
        <AppLayout>
          <Component {...pageProps} />
        </AppLayout>
      ) : (
        <Component {...pageProps} />
      )}
    </>
  );
}
