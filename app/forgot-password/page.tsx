"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendResetEmail(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");
    setError("");
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo:
            `${window.location.origin}/reset-password`,
        }
      );

      if (error) throw error;

      setMessage(
        "إذا كان هذا البريد مسجلًا لدينا، فستصلك رسالة تحتوي على رابط إعادة تعيين كلمة المرور. يرجى فحص صندوق الوارد والبريد غير المرغوب فيه."
      );
    } catch (err) {
      console.error("Password reset error:", err);
      setError(
        "تعذر إرسال طلب الاستعادة حاليًا. يرجى المحاولة مرة أخرى."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      dir="rtl"
      lang="ar"
      style={{
        maxWidth: 420,
        margin: "60px auto",
        padding: 25,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1>نسيت كلمة المرور؟</h1>

      <p>
        أدخل بريدك الإلكتروني المسجل لدينا، وسنرسل لك رابطًا
        لإعادة تعيين كلمة المرور.
      </p>

      <form onSubmit={sendResetEmail}>
        <label htmlFor="email">البريد الإلكتروني</label>

        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          placeholder="example@email.com"
          style={{
            display: "block",
            width: "100%",
            padding: 12,
            marginTop: 8,
            marginBottom: 15,
            boxSizing: "border-box",
          }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: 12,
            cursor: loading ? "wait" : "pointer",
          }}
        >
          {loading ? "جارٍ الإرسال..." : "إرسال رابط الاستعادة"}
        </button>
      </form>

      {message && (
        <p role="status" style={{ color: "green", marginTop: 20 }}>
          {message}
        </p>
      )}

      {error && (
        <p role="alert" style={{ color: "red", marginTop: 20 }}>
          {error}
        </p>
      )}

      <p style={{ marginTop: 25 }}>
        <Link href="/login">العودة إلى تسجيل الدخول</Link>
      </p>
    </main>
  );
}