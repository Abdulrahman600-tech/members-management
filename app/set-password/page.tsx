"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function SetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function checkInvitation() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");

      if (code) {
        const { error } =
          await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          setMessage("رابط الدعوة غير صالح أو انتهت صلاحيته.");
          setLoading(false);
          return;
        }
      }

      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        setMessage("لم يتم العثور على جلسة صالحة. افتح رابط الدعوة من بريدك الإلكتروني مرة أخرى.");
      }

      setLoading(false);
    }

    checkInvitation();
  }, []);

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    if (password.length < 8) {
      setMessage("يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("كلمتا المرور غير متطابقتين.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    setSaving(false);

    if (error) {
      setMessage("تعذر حفظ كلمة المرور: " + error.message);
      return;
    }

    setMessage("تم إنشاء كلمة المرور بنجاح. سيتم تحويلك إلى صفحة العضو.");

    setTimeout(() => {
      router.push("/member");
    }, 2000);
  }

  if (loading) {
    return <main style={{ padding: 30 }}>جارٍ التحقق من رابط الدعوة...</main>;
  }

  return (
    <main
      style={{
        maxWidth: 420,
        margin: "60px auto",
        padding: 25,
        fontFamily: "Arial",
        direction: "rtl",
      }}
    >
      <h1>إنشاء كلمة المرور</h1>

      <p>اختر كلمة مرور خاصة بحسابك.</p>

      {message && (
        <p style={{ background: "#f1f1f1", padding: 12 }}>
          {message}
        </p>
      )}

      <form onSubmit={savePassword}>
        <label>كلمة المرور الجديدة</label>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          style={{
            display: "block",
            width: "100%",
            padding: 12,
            margin: "8px 0 18px",
            boxSizing: "border-box",
          }}
        />

        <label>تأكيد كلمة المرور</label>

        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={8}
          style={{
            display: "block",
            width: "100%",
            padding: 12,
            margin: "8px 0 18px",
            boxSizing: "border-box",
          }}
        />

        <button
          type="submit"
          disabled={saving || !password || !confirmPassword}
          style={{
            width: "100%",
            padding: 14,
            cursor: "pointer",
          }}
        >
          {saving ? "جارٍ الحفظ..." : "حفظ كلمة المرور"}
        </button>
      </form>
    </main>
  );
}