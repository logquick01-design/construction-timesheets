import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-slate-850">
            Log<span className="text-[var(--color-accent)]">Q</span>
          </h1>
          <p className="mt-2 text-slate-600">Construction labour tracking</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
