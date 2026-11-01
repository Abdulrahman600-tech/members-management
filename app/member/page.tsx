

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Member = {
  id: number;
  name: string;
  email: string;
  monthly_fee: number;
  is_active: boolean;
};

type Payment = {
  id: number;
  payment_month: string;
  amount: number;
  is_paid: boolean;
  paid_at: string | null;
};

export default function MemberPage() {
  const router = useRouter();

  const [member, setMember] = useState<Member | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadMemberData() {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          router.replace("/login");
          return;
        }

        const { data: role, error: roleError } =
          await supabase.rpc("current_user_role");

        if (roleError || role !== "member") {
          setError("هذا الحساب ليس حساب عضو عادي.");
          await supabase.auth.signOut();
          router.replace("/login");
          return;
        }

        const { data: memberData, error: memberError } =
          await supabase
            .from("members")
            .select("id, name, email, monthly_fee, is_active")
            .eq("auth_user_id", user.id)
            .single();

        if (memberError) throw memberError;

        if (!memberData.is_active) {
          setError(
            "حسابك موقوف حالياً. يرجى التواصل مع الإدارة."
          );

          await supabase.auth.signOut();
          router.replace("/login");
          return;
        }

        setMember(memberData);

        const { data: paymentData, error: paymentError } =
          await supabase
            .from("monthly_payments")
            .select("id, payment_month, amount, is_paid, paid_at")
            .eq("member_id", memberData.id)
            .order("payment_month", { ascending: false });

        if (paymentError) throw paymentError;

        setPayments(paymentData || []);
      } catch (err) {
        console.error("Member page error:", err);

        setError(
          "تعذر تحميل بيانات العضو. يرجى المحاولة مرة أخرى."
        );
      } finally {
        setLoading(false);
      }
    }

    loadMemberData();
  }, [router]);

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  if (loading) {
    return (
      <main dir="rtl" style={{ padding: 30 }}>
        جارٍ تحميل بياناتك...
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      style={{
        maxWidth: 750,
        margin: "30px auto",
        padding: 20,
        fontFamily: "Arial",
      }}
    >
      <h1>صفحة العضو</h1>

      {error && (
        <p style={{ color: "red" }}>{error}</p>
      )}

      {member && (
        <>
          <section
            style={{
              border: "1px solid #ddd",
              borderRadius: 10,
              padding: 20,
              marginBottom: 20,
            }}
          >
            <h2>بياناتي</h2>
            <p>الاسم: {member.name}</p>
            <p>البريد الإلكتروني: {member.email}</p>
            <p>الاشتراك الشهري: {member.monthly_fee} €</p>
          </section>

          <section
            style={{
              border: "1px solid #ddd",
              borderRadius: 10,
              padding: 20,
            }}
          >
            <h2>اشتراكاتي الشهرية</h2>

            {payments.length === 0 ? (
              <p>لا توجد دفعات مسجلة حتى الآن.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    textAlign: "right",
                  }}
                >
                  <thead>
                    <tr>
                      <th style={{ padding: 10 }}>الشهر</th>
                      <th style={{ padding: 10 }}>المبلغ</th>
                      <th style={{ padding: 10 }}>الحالة</th>
                    </tr>
                  </thead>

                  <tbody>
                    {payments.map((payment) => (
                      <tr key={payment.id}>
                        <td style={{ padding: 10 }}>
                          {payment.payment_month}
                        </td>

                        <td style={{ padding: 10 }}>
                          {payment.amount} €
                        </td>

                        <td style={{ padding: 10 }}>
                          {payment.is_paid
                            ? "تم تأكيد الدفع"
                            : "بانتظار الدفع"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <button
            onClick={logout}
            style={{
              marginTop: 25,
              padding: 12,
              cursor: "pointer",
            }}
          >
            تسجيل الخروج
          </button>
        </>
      )}
    </main>
  );
}
```