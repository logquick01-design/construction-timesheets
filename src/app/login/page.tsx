import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-black">
            Log<span className="text-accent">Q</span>
          </h1>
          <p className="mt-2 text-muted">Construction labour tracking</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
