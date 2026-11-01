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

function euro(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

function formatMonth(value: string) {
  const date = new Date(value + "T00:00:00");
  return new Intl.DateTimeFormat("ar", {
    year: "numeric",
    month: "long",
  }).format(date);
}

export default function MemberPage() {
  const router = useRouter();

  const [member, setMember] = useState<Member | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

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
          if (active) {
            setError("هذا الحساب ليس حساب عضو عادي.");
          }
          await supabase.auth.signOut();
          router.replace("/login");
          return;
        }

        const { data: memberData, error: memberError } =
          await supabase
            .from("members")
            .select("id, name, email, monthly_fee, is_active")
            .eq("auth_user_id", user.id)
            .maybeSingle();

        if (memberError) {
          throw memberError;
        }

        if (!memberData) {
          if (active) {
            setError(
              "تعذر العثور على بيانات العضوية أو أن الحساب غير نشط. يرجى التواصل مع الإدارة."
            );
          }
          await supabase.auth.signOut();
          router.replace("/login");
          return;
        }

        if (!memberData.is_active) {
          if (active) {
            setError(
              "حسابك موقوف حاليًا. يرجى التواصل مع الإدارة."
            );
          }
          await supabase.auth.signOut();
          router.replace("/login");
          return;
        }

        if (active) {
          setMember(memberData);
        }

        const { data: paymentData, error: paymentError } =
          await supabase
            .from("monthly_payments")
            .select("id, payment_month, amount, is_paid, paid_at")
            .eq("member_id", memberData.id)
            .order("payment_month", { ascending: false });

        if (paymentError) {
          throw paymentError;
        }

        if (active) {
          setPayments(paymentData || []);
        }
      } catch (err) {
        console.error("Member page error:", err);

        if (active) {
          setError(
            "تعذر تحميل بيانات العضو. يرجى المحاولة مرة أخرى."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadMemberData();

    return () => {
      active = false;
    };
  }, [router]);

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  if (loading) {
    return (
      <main dir="rtl" style={{ padding: 30, textAlign: "center" }}>
        جارٍ تحميل بياناتك...
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      lang="ar"
      style={{
        maxWidth: 750,
        margin: "30px auto",
        padding: 20,
        fontFamily: "Arial, sans-serif",
        color: "#202124",
        background: "#ffffff",
        minHeight: "80vh",
      }}
    >
      <h1>صفحة العضو</h1>

      {error && (
        <p
          role="alert"
          style={{
            color: "#991b1b",
            background: "#fee2e2",
            padding: 12,
            borderRadius: 8,
          }}
        >
          {error}
        </p>
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
            <p>الاشتراك الشهري: {euro(Number(member.monthly_fee))}</p>
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
                          {formatMonth(payment.payment_month)}
                        </td>

                        <td style={{ padding: 10 }}>
                          {euro(Number(payment.amount))}
                        </td>

                        <td
                          style={{
                            padding: 10,
                            color: payment.is_paid ? "#166534" : "#991b1b",
                            fontWeight: 700,
                          }}
                        >
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
              border: "none",
              borderRadius: 8,
              background: "#202124",
              color: "#ffffff",
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