import { getAuthCallbackUrl } from "@/lib/app-url";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return <LoginForm emailRedirectTo={getAuthCallbackUrl()} />;
}
