
"use client";

import { useState } from "react";
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
      // تسجيل الدخول
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

      // التحقق من صلاحية الحساب
      const { data: roleData, error: roleError } =
        await supabase.rpc("current_user_role");

      if (roleError) {
        await supabase.auth.signOut();
        setError("تعذر التحقق من صلاحيات الحساب. حاول مرة أخرى.");
        return;
      }

      // توجيه المدير إلى لوحة الإدارة
      if (roleData === "admin") {
        router.replace("/");
        router.refresh();
        return;
      }

      // توجيه العضو إلى صفحته الخاصة
      if (roleData === "member") {
        router.replace("/member");
        router.refresh();
        return;
      }

      // رفض أي صلاحية غير معروفة
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
      style={{
        maxWidth: 400,
        margin: "80px auto",
        padding: 24,
        fontFamily: "Arial",
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
            margin: "8px 0 16px",
            boxSizing: "border-box",
          }}
        />

        {error && (
          <p style={{ color: "red" }}>{error}</p>
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
