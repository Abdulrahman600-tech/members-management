


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
          setError("Ù‡Ø°Ø§ Ø§Ù„Ø­Ø³Ø§Ø¨ Ù„ÙŠØ³ Ø­Ø³Ø§Ø¨ Ø¹Ø¶Ùˆ Ø¹Ø§Ø¯ÙŠ.");
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
            "Ø­Ø³Ø§Ø¨Ùƒ Ù…ÙˆÙ‚ÙˆÙ Ø­Ø§Ù„ÙŠØ§Ù‹. ÙŠØ±Ø¬Ù‰ Ø§Ù„ØªÙˆØ§ØµÙ„ Ù…Ø¹ Ø§Ù„Ø¥Ø¯Ø§Ø±Ø©."
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
          "ØªØ¹Ø°Ø± ØªØ­Ù…ÙŠÙ„ Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ø¹Ø¶Ùˆ. ÙŠØ±Ø¬Ù‰ Ø§Ù„Ù…Ø­Ø§ÙˆÙ„Ø© Ù…Ø±Ø© Ø£Ø®Ø±Ù‰."
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
        Ø¬Ø§Ø±Ù ØªØ­Ù…ÙŠÙ„ Ø¨ÙŠØ§Ù†Ø§ØªÙƒ...
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
      <h1>ØµÙØ­Ø© Ø§Ù„Ø¹Ø¶Ùˆ</h1>

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
            <h2>Ø¨ÙŠØ§Ù†Ø§ØªÙŠ</h2>
            <p>Ø§Ù„Ø§Ø³Ù…: {member.name}</p>
            <p>Ø§Ù„Ø¨Ø±ÙŠØ¯ Ø§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠ: {member.email}</p>
            <p>Ø§Ù„Ø§Ø´ØªØ±Ø§Ùƒ Ø§Ù„Ø´Ù‡Ø±ÙŠ: {member.monthly_fee} â‚¬</p>
          </section>

          <section
            style={{
              border: "1px solid #ddd",
              borderRadius: 10,
              padding: 20,
            }}
          >
            <h2>Ø§Ø´ØªØ±Ø§ÙƒØ§ØªÙŠ Ø§Ù„Ø´Ù‡Ø±ÙŠØ©</h2>

            {payments.length === 0 ? (
              <p>Ù„Ø§ ØªÙˆØ¬Ø¯ Ø¯ÙØ¹Ø§Øª Ù…Ø³Ø¬Ù„Ø© Ø­ØªÙ‰ Ø§Ù„Ø¢Ù†.</p>
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
                      <th style={{ padding: 10 }}>Ø§Ù„Ø´Ù‡Ø±</th>
                      <th style={{ padding: 10 }}>Ø§Ù„Ù…Ø¨Ù„Øº</th>
                      <th style={{ padding: 10 }}>Ø§Ù„Ø­Ø§Ù„Ø©</th>
                    </tr>
                  </thead>

                  <tbody>
                    {payments.map((payment) => (
                      <tr key={payment.id}>
                        <td style={{ padding: 10 }}>
                          {payment.payment_month}
                        </td>

                        <td style={{ padding: 10 }}>
                          {payment.amount} â‚¬
                        </td>

                        <td style={{ padding: 10 }}>
                          {payment.is_paid
                            ? "ØªÙ… ØªØ£ÙƒÙŠØ¯ Ø§Ù„Ø¯ÙØ¹"
                            : "Ø¨Ø§Ù†ØªØ¸Ø§Ø± Ø§Ù„Ø¯ÙØ¹"}
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
            ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø®Ø±ÙˆØ¬
          </button>
        </>
      )}
    </main>
  );
}

