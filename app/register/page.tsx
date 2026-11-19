import { AuthForm } from "@/components/auth-form";

export const metadata = {
  title: "Create an account | StanBridge Airways",
};

export default function RegisterPage() {
  return <AuthForm mode="register" />;
}
