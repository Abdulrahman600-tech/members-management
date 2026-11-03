"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function checkSession() {
      const { data, error } = await supabase.auth.getSession();

      if (!active) return;

      if (error || !data.session) {
        setError(
          "رابط إعادة تعيين كلمة المرور غير صالح أو انتهت صلاحيته. يرجى طلب رابط جديد."
        );
      } else {
        setReady(true);
      }
    }

    void checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;

      if (event === "PASSWORD_RECOVERY" && session) {
        setReady(true);
        setError("");
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function updatePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");
    setError("");

    if (password.length < 8) {
      setError("يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.");
      return;
    }

    if (password !== confirmPassword) {
      setError("كلمتا المرور غير متطابقتين.");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) throw error;

      setMessage("تم تغيير كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول.");

      await supabase.auth.signOut();
      setPassword("");
      setConfirmPassword("");
      setReady(false);
    } catch (err) {
      console.error("Password update error:", err);
      setError(
        "تعذر تغيير كلمة المرور. يرجى طلب رابط استعادة جديد والمحاولة مرة أخرى."
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
      <h1>إعادة تعيين كلمة المرور</h1>

      {ready && (
        <form onSubmit={updatePassword}>
          <label htmlFor="password">كلمة المرور الجديدة</label>

          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            autoComplete="new-password"
            required
            style={{
              display: "block",
              width: "100%",
              padding: 12,
              marginTop: 8,
              marginBottom: 15,
              boxSizing: "border-box",
            }}
          />

          <label htmlFor="confirmPassword">
            تأكيد كلمة المرور الجديدة
          </label>

          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={8}
            autoComplete="new-password"
            required
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
            {loading ? "جارٍ الحفظ..." : "حفظ كلمة المرور الجديدة"}
          </button>
        </form>
      )}

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

      {message && (
        <p>
          <Link href="/login">الانتقال إلى تسجيل الدخول</Link>
        </p>
      )}

      {!ready && !message && error && (
        <p>
          <Link href="/forgot-password">
            طلب رابط استعادة جديد
          </Link>
        </p>
      )}
    </main>
  );
}