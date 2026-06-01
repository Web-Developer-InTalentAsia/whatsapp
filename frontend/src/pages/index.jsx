import { useEffect } from "react";
import { useRouter } from "next/router";
import Cookies from "js-cookie";

export default function IndexPage() {
  const router = useRouter();

  useEffect(() => {
    const token = Cookies.get("access_token");
    router.replace(token ? "/dashboard" : "/login");
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
