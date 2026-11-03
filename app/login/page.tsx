"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { error: loginError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (loginError) {
        setError(
          "فشل تسجيل الدخول. تحقق من البريد الإلكتروني وكلمة المرور."
        );
        return;
      }

      const { data: roleData, error: roleError } =
        await supabase.rpc("current_user_role");

      if (roleError) {
        await supabase.auth.signOut();
        setError("تعذر التحقق من صلاحيات الحساب. حاول مرة أخرى.");
        return;
      }

      if (roleData === "admin") {
        router.replace("/");
        router.refresh();
        return;
      }

      if (roleData === "member") {
        router.replace("/member");
        router.refresh();
        return;
      }

      await supabase.auth.signOut();
      setError("هذا الحساب لا يملك صلاحية دخول معتمدة.");
    } catch (err) {
      console.error("Login error:", err);
      setError("حدث خطأ أثناء تسجيل الدخول. حاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      dir="rtl"
      lang="ar"
      style={{
        maxWidth: 400,
        margin: "80px auto",
        padding: 24,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1>تسجيل الدخول</h1>
      <p>برنامج إدارة الأعضاء</p>

      <form onSubmit={handleLogin}>
        <label htmlFor="email">البريد الإلكتروني</label>

        <input
          id="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            display: "block",
            width: "100%",
            padding: 10,
            margin: "8px 0 16px",
            boxSizing: "border-box",
          }}
        />

        <label htmlFor="password">كلمة المرور</label>

        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            display: "block",
            width: "100%",
            padding: 10,
            margin: "8px 0 8px",
            boxSizing: "border-box",
          }}
        />

        <div style={{ textAlign: "left", marginBottom: 16 }}>
          <Link
            href="/forgot-password"
            style={{
              color: "#2563eb",
              textDecoration: "underline",
              fontSize: 14,
            }}
          >
            نسيت كلمة المرور؟
          </Link>
        </div>

        {error && (
          <p style={{ color: "red" }} role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: 12,
            cursor: loading ? "wait" : "pointer",
          }}
        >
          {loading ? "جارٍ التحقق..." : "دخول"}
        </button>
      </form>
    </main>
  );
}