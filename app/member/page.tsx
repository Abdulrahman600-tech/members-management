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
  member_reported: boolean;
  member_reported_at: string | null;
};

type Language = "ar" | "de";

function getGermanyDateParts() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    year: get("year"),
    month: get("month"),
    day: Number(get("day")),
  };
}

function euro(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

function formatMonth(value: string, language: Language) {
  const date = new Date(value + "T00:00:00");

  return new Intl.DateTimeFormat(
    language === "ar" ? "ar" : "de-DE",
    {
      year: "numeric",
      month: "long",
    }
  ).format(date);
}

export default function MemberPage() {
  const router = useRouter();

  const [member, setMember] = useState<Member | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [language, setLanguage] = useState<Language>("ar");
  const [reporting, setReporting] = useState(false);
  const [reportMessage, setReportMessage] = useState("");
  const [reportError, setReportError] = useState("");

  const [germanyDate, setGermanyDate] = useState<{
    currentMonth: string;
    day: number;
  } | null>(null);

  const currentMonth = germanyDate?.currentMonth ?? "";
  const day = germanyDate?.day ?? 1;

  const isArabic = language === "ar";
  const direction = isArabic ? "rtl" : "ltr";

  const t = {
    title: isArabic ? "صفحة العضو" : "Mitgliederbereich",
    myData: isArabic ? "بياناتي" : "Meine Daten",
    name: isArabic ? "الاسم" : "Name",
    email: isArabic ? "البريد الإلكتروني" : "E-Mail",
    monthlyFee: isArabic ? "الاشتراك الشهري" : "Monatsbeitrag",
    myPayments: isArabic ? "اشتراكاتي الشهرية" : "Meine Monatsbeiträge",
    month: isArabic ? "الشهر" : "Monat",
    amount: isArabic ? "المبلغ" : "Betrag",
    status: isArabic ? "الحالة" : "Status",

    noPayments: isArabic
      ? "لا توجد دفعات مسجلة حتى الآن."
      : "Bisher sind keine Zahlungen eingetragen.",

    paid: isArabic ? "تم تأكيد الدفع" : "Zahlung bestätigt",

    reported: isArabic
      ? "تم إبلاغ الإدارة، بانتظار التأكيد"
      : "Zahlung gemeldet – Bestätigung ausstehend",

    waiting: isArabic ? "بانتظار الدفع" : "Zahlung ausstehend",

    reportButton: isArabic
      ? "لقد قمت بالدفع"
      : "Ich habe bezahlt",

    reporting: isArabic
      ? "جارٍ إرسال الإبلاغ..."
      : "Meldung wird gesendet...",

    reportSuccess: isArabic
      ? "تم إرسال إشعار الدفع إلى الإدارة بنجاح."
      : "Ihre Zahlungsmitteilung wurde erfolgreich gesendet.",

    reportFailed: isArabic
      ? "تعذر إرسال الإبلاغ عن الدفع."
      : "Die Zahlungsmeldung konnte nicht gesendet werden.",

    noCurrentPayment: isArabic
      ? "لا يوجد سجل دفع للشهر الحالي حتى الآن. يرجى التواصل مع الإدارة."
      : "Für den aktuellen Monat liegt noch kein Zahlungseintrag vor. Bitte wenden Sie sich an die Verwaltung.",

    reminder: isArabic
      ? "يرجى دفع الاشتراك الشهري بين اليوم الأول والخامس من الشهر."
      : "Bitte bezahlen Sie Ihren Monatsbeitrag zwischen dem 1. und 5. des Monats.",

    overdue: isArabic
      ? "تنبيه: لم يتم تأكيد دفع هذا الشهر بعد. يرجى إتمام الدفع والتواصل مع الإدارة عند الحاجة."
      : "Hinweis: Die Zahlung für diesen Monat wurde noch nicht bestätigt. Bitte begleichen Sie den Beitrag.",

    thankYou: isArabic
      ? "شكراً لك، تم تأكيد دفع هذا الشهر."
      : "Vielen Dank! Die Zahlung für diesen Monat wurde bestätigt.",

    logout: isArabic ? "تسجيل الخروج" : "Abmelden",

    loading: isArabic
      ? "جارٍ تحميل بياناتك..."
      : "Ihre Daten werden geladen.",

    loadError: isArabic
      ? "تعذر تحميل بيانات العضو. يرجى المحاولة مرة أخرى."
      : "Mitgliedsdaten konnten nicht geladen werden. Bitte versuchen Sie es erneut.",
  };

  useEffect(() => {
    let active = true;

    async function loadMemberData() {
      try {
        // حساب التاريخ حسب توقيت ألمانيا بعد فتح الصفحة في المتصفح
        const parts = getGermanyDateParts();

        if (active) {
          setGermanyDate({
            currentMonth: `${parts.year}-${parts.month}-01`,
            day: parts.day,
          });
        }

        // التحقق من تسجيل الدخول
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          router.replace("/login");
          return;
        }

        // التحقق من صلاحية العضو
        const { data: role, error: roleError } =
          await supabase.rpc("current_user_role");

        if (roleError || role !== "member") {
          if (active) {
            setError(
              isArabic
                ? "هذا الحساب ليس حساب عضو عادي."
                : "Dieses Konto ist kein reguläres Mitgliedskonto."
            );
          }

          await supabase.auth.signOut();
          router.replace("/login");
          return;
        }

        // تحميل بيانات العضو
        const { data: memberData, error: memberError } =
          await supabase
            .from("members")
            .select("id, name, email, monthly_fee, is_active")
            .eq("auth_user_id", user.id)
            .maybeSingle();

        if (memberError) {
          throw memberError;
        }

        if (!memberData || !memberData.is_active) {
          if (active) {
            setError(
              isArabic
                ? "حسابك موقوف حاليًا. يرجى التواصل مع الإدارة."
                : "Ihr Konto ist derzeit deaktiviert. Bitte wenden Sie sich an die Verwaltung."
            );
          }

          await supabase.auth.signOut();
          router.replace("/login");
          return;
        }

        // تحميل دفعات هذا العضو فقط
        const { data: paymentData, error: paymentError } =
          await supabase
            .from("monthly_payments")
            .select(
              "id, payment_month, amount, is_paid, paid_at, member_reported, member_reported_at"
            )
            .eq("member_id", memberData.id)
            .order("payment_month", { ascending: false });

        if (paymentError) {
          throw paymentError;
        }

        if (active) {
          setMember(memberData);
          setPayments(paymentData || []);
        }
      } catch (err) {
        console.error("Member page error:", err);

        if (active) {
          setError(
            isArabic
              ? "تعذر تحميل بيانات العضو. يرجى المحاولة مرة أخرى."
              : "Mitgliedsdaten konnten nicht geladen werden. Bitte versuchen Sie es erneut."
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

  // إبلاغ الإدارة عن دفع الشهر الحالي
  async function reportPayment() {
    if (reporting || !currentMonth) {
      return;
    }

    setReporting(true);
    setReportMessage("");
    setReportError("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error(
          isArabic
            ? "انتهت جلسة الدخول."
            : "Ihre Sitzung ist abgelaufen."
        );
      }

      const response = await fetch("/api/member/report-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || t.reportFailed);
      }

      setReportMessage(result.message || t.reportSuccess);

      setPayments((previous) =>
        previous.map((payment) =>
          payment.payment_month === currentMonth
            ? {
                ...payment,
                member_reported: true,
                member_reported_at: new Date().toISOString(),
              }
            : payment
        )
      );
    } catch (err) {
      setReportError(
        err instanceof Error ? err.message : t.reportFailed
      );
    } finally {
      setReporting(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const currentPayment = payments.find(
    (payment) => payment.payment_month === currentMonth
  );

  if (loading || !germanyDate) {
    return (
      <main
        dir={direction}
        style={{
          minHeight: "100vh",
          boxSizing: "border-box",
          padding: 30,
          textAlign: "center",
          background: "#c9f2df",
          color: "#202124",
          fontFamily: "Arial, sans-serif",
        }}
      >
        {t.loading}
      </main>
    );
  }

  return (
    <main
      dir={direction}
      lang={language}
      style={{
        width: "100%",
        minHeight: "100vh",
        boxSizing: "border-box",
        margin: 0,
        padding: "30px 16px",
        fontFamily: "Arial, sans-serif",
        color: "#202124",
        background: "#c9f2df",
      }}
    >
      <div
        style={{
          maxWidth: 850,
          margin: "0 auto",
        }}
      >
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 25,
          }}
        >
          <h1 style={{ margin: 0 }}>{t.title}</h1>

          <button
            onClick={() =>
              setLanguage((previous) =>
                previous === "ar" ? "de" : "ar"
              )
            }
            style={{
              padding: "10px 16px",
              border: "1px solid #ccc",
              borderRadius: 8,
              background: "#ffffff",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            {isArabic ? "Deutsch" : "العربية"}
          </button>
        </header>

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
            {/* بيانات العضو */}
            <section
              style={{
                border: "1px solid #d1d5db",
                borderRadius: 12,
                padding: 20,
                marginBottom: 20,
                background: "#ffffff",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              }}
            >
              <h2>{t.myData}</h2>

              <p>{t.name}: {member.name}</p>
              <p>{t.email}: {member.email}</p>

              <p>
                {t.monthlyFee}:{" "}
                <strong>
                  {euro(Number(member.monthly_fee))}
                </strong>
              </p>
            </section>

            {/* حالة دفع الشهر الحالي */}
            {currentPayment ? (
              <section
                style={{
                  borderRadius: 12,
                  padding: 20,
                  marginBottom: 20,
                  background: currentPayment.is_paid
                    ? "#dcfce7"
                    : currentPayment.member_reported
                      ? "#eff6ff"
                      : day > 5
                        ? "#fee2e2"
                        : "#fef3c7",
                  border: `1px solid ${
                    currentPayment.is_paid
                      ? "#86efac"
                      : currentPayment.member_reported
                        ? "#93c5fd"
                        : day > 5
                          ? "#fca5a5"
                          : "#fcd34d"
                  }`,
                }}
              >
                <h2>
                  {formatMonth(currentMonth, language)}
                </h2>

                <p>
                  {t.amount}:{" "}
                  <strong>
                    {euro(Number(currentPayment.amount))}
                  </strong>
                </p>

                {currentPayment.is_paid ? (
                  <p
                    style={{
                      color: "#166534",
                      fontWeight: 700,
                    }}
                  >
                    ✓ {t.thankYou}
                  </p>
                ) : currentPayment.member_reported ? (
                  <p
                    style={{
                      color: "#1d4ed8",
                      fontWeight: 700,
                    }}
                  >
                    ✓ {t.reported}
                  </p>
                ) : (
                  <>
                    <p
                      style={{
                        color: day > 5 ? "#991b1b" : "#92400e",
                        fontWeight: 700,
                      }}
                    >
                      {day > 5 ? t.overdue : t.reminder}
                    </p>

                    <button
                      onClick={reportPayment}
                      disabled={reporting}
                      style={{
                        padding: "12px 20px",
                        border: "none",
                        borderRadius: 8,
                        background: "#2563eb",
                        color: "#ffffff",
                        cursor: reporting ? "wait" : "pointer",
                        opacity: reporting ? 0.7 : 1,
                        fontWeight: 700,
                      }}
                    >
                      {reporting ? t.reporting : t.reportButton}
                    </button>
                  </>
                )}

                {reportMessage && (
                  <p
                    role="status"
                    style={{ color: "#166534" }}
                  >
                    {reportMessage}
                  </p>
                )}

                {reportError && (
                  <p
                    role="alert"
                    style={{ color: "#991b1b" }}
                  >
                    {reportError}
                  </p>
                )}
              </section>
            ) : (
              <section
                style={{
                  padding: 16,
                  marginBottom: 20,
                  borderRadius: 10,
                  background: "#ffffff",
                  color: "#374151",
                }}
              >
                {t.noCurrentPayment}
              </section>
            )}

            {/* سجل الدفعات */}
            <section
              style={{
                border: "1px solid #d1d5db",
                borderRadius: 12,
                padding: 20,
                background: "#ffffff",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              }}
            >
              <h2>{t.myPayments}</h2>

              {payments.length === 0 ? (
                <p>{t.noPayments}</p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      textAlign: isArabic ? "right" : "left",
                    }}
                  >
                    <thead>
                      <tr style={{ background: "#f3f4f6" }}>
                        <th style={{ padding: 12 }}>
                          {t.month}
                        </th>
                        <th style={{ padding: 12 }}>
                          {t.amount}
                        </th>
                        <th style={{ padding: 12 }}>
                          {t.status}
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {payments.map((payment) => {
                        let status = t.waiting;
                        let color = "#991b1b";

                        if (payment.is_paid) {
                          status = t.paid;
                          color = "#166534";
                        } else if (payment.member_reported) {
                          status = t.reported;
                          color = "#1d4ed8";
                        }

                        return (
                          <tr
                            key={payment.id}
                            style={{
                              borderTop: "1px solid #e5e7eb",
                            }}
                          >
                            <td style={{ padding: 12 }}>
                              {formatMonth(
                                payment.payment_month,
                                language
                              )}
                            </td>

                            <td style={{ padding: 12 }}>
                              {euro(Number(payment.amount))}
                            </td>

                            <td
                              style={{
                                padding: 12,
                                color,
                                fontWeight: 700,
                              }}
                            >
                              {status}
                            </td>
                          </tr>
                        );
                      })}
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
                fontWeight: 700,
              }}
            >
              {t.logout}
            </button>
          </>
        )}
      </div>
    </main>
  );
}