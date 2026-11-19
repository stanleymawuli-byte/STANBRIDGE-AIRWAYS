import { PasswordRecoveryForm } from "@/components/password-recovery-form";

export const metadata = {
  title: "Reset password | StanBridge Airways",
};

export default function ForgotPasswordPage() {
  return <PasswordRecoveryForm mode="request" />;
}
