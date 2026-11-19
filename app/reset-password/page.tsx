import { PasswordRecoveryForm } from "@/components/password-recovery-form";

export const metadata = {
  title: "Choose a new password | StanBridge Airways",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const params = await searchParams;
  return (
    <PasswordRecoveryForm
      mode="reset"
      token={params.token}
      invalidToken={params.error === "INVALID_TOKEN" || !params.token}
    />
  );
}
