
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import * as XLSX from "xlsx";

const ADMIN_UID = "56ac1884-fcdb-469a-9531-294b2364e71f";

type Member = {
  id: number;
  name: string;
  email: string;
  monthlyFee: number;
  is_active: boolean;
};

type Payment = {
  id: number;
  member_id: number | null;
  payment_month: string;
  amount: number;
  is_paid: boolean;
  paid_at: string | null;
};

type Transaction = {
  id: number;
  transaction_type: "income" | "expense";
  amount: number;
  description: string;
  category: string | null;
  transaction_date: string;
};

const todayString = () => new Date().toISOString().slice(0, 10);
const monthString = () => todayString().slice(0, 7);
const monthDate = (month: string) => `${month}-01`;

function euro(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

const colors = {
  purple: "#7c3aed",
  green: "#15803d",
  red: "#dc2626",
  orange: "#ea580c",
  blue: "#2563eb",
  dark: "#202124",
  white: "#ffffff",
};

const buttonStyle: React.CSSProperties = {
  color: colors.white,
  border: "none",
  borderRadius: 8,
  padding: "10px 16px",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 14,
};

const cellStyle: React.CSSProperties = {
  padding: 10,
  borderBottom: "1px solid #ddd",
  textAlign: "start",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  padding: 11,
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  background: "#ffffff",
  color: "#202124",
};

export default function HomePage() {
  const router = useRouter();

  const [language, setLanguage] = useState<"ar" | "de">("ar");
  const [authChecking, setAuthChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [members, setMembers] = useState<Member[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const [month, setMonth] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [monthlyFee, setMonthlyFee] = useState("250");

  const [transactionType, setTransactionType] =
    useState<"income" | "expense">("expense");
  const [transactionAmount, setTransactionAmount] = useState("");
  const [transactionDescription, setTransactionDescription] = useState("");
  const [transactionCategory, setTransactionCategory] = useState("");
  const [transactionDate, setTransactionDate] = useState("");

  const ar = language === "ar";

  useEffect(() => {
    let active = true;

    async function checkSession() {
      const { data, error } = await supabase.auth.getSession();
      if (!active) return;

      if (error || !data.session) {
        router.replace("/login");
        return;
      }

      if (data.session.user.id !== ADMIN_UID) {
        router.replace("/member");
        return;
      }

      setAuthChecking(false);
    }

    void checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace("/login");
      } else if (session.user.id !== ADMIN_UID) {
        router.replace("/member");
      } else if (active) {
        setAuthChecking(false);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    setMonth(monthString());
    setTransactionDate(todayString());
  }, []);

  const loadMembers = useCallback(async () => {
    const { data, error } = await supabase
      .from("members")
      .select("id, name, email, monthly_fee, is_active")
      .order("id", { ascending: true });

    if (error) {
      setMessage(
        `${ar ? "خطأ في تحميل الأعضاء" : "Fehler beim Laden der Mitglieder"}: ${error.message}`
      );
      return;
    }

    setMembers(
      (data ?? []).map((row) => ({
        id: Number(row.id),
        name: row.name ?? "",
        email: row.email ?? "",
        monthlyFee: Number(row.monthly_fee ?? 250),
        is_active: Boolean(row.is_active),
      }))
    );
  }, [ar]);

  const loadPayments = useCallback(async () => {
    if (!month) return;

    const { data, error } = await supabase
      .from("monthly_payments")
      .select("id, member_id, payment_month, amount, is_paid, paid_at")
      .eq("payment_month", monthDate(month));

    if (error) {
      setMessage(
        `${ar ? "خطأ في تحميل الدفعات" : "Fehler beim Laden der Zahlungen"}: ${error.message}`
      );
      return;
    }

    setPayments(
      (data ?? []).map((row) => ({
        id: Number(row.id),
        member_id: row.member_id === null ? null : Number(row.member_id),
        payment_month: row.payment_month,
        amount: Number(row.amount ?? 0),
        is_paid: Boolean(row.is_paid),
        paid_at: row.paid_at ?? null,
      }))
    );
  }, [month, ar]);

  const loadTransactions = useCallback(async () => {
    if (!month) return;

    const [year, monthNumber] = month.split("-").map(Number);
    const nextMonth = new Date(year, monthNumber, 1);
    const nextMonthFirstDay = [
      nextMonth.getFullYear(),
      String(nextMonth.getMonth() + 1).padStart(2, "0"),
      "01",
    ].join("-");

    const { data, error } = await supabase
      .from("financial_transactions")
      .select(
        "id, transaction_type, amount, description, category, transaction_date"
      )
      .gte("transaction_date", `${month}-01`)
      .lt("transaction_date", nextMonthFirstDay)
      .order("transaction_date", { ascending: false });

    if (error) {
      setMessage(
        `${ar ? "خطأ في تحميل الحركات المالية" : "Fehler beim Laden der Finanzbuchungen"}: ${error.message}`
      );
      return;
    }

    setTransactions(
      (data ?? []).map((row) => ({
        id: Number(row.id),
        transaction_type: row.transaction_type,
        amount: Number(row.amount ?? 0),
        description: row.description ?? "",
        category: row.category ?? null,
        transaction_date: row.transaction_date,
      }))
    );
  }, [month, ar]);

  useEffect(() => {
    if (!authChecking) void loadMembers();
  }, [authChecking, loadMembers]);

  useEffect(() => {
    if (authChecking || !month) return;
    void loadPayments();
    void loadTransactions();
  }, [authChecking, month, loadPayments, loadTransactions]);

  async function addMember(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();
  setMessage("");

  if (!name.trim() || !email.trim()) {
    setMessage(
      ar
        ? "أدخل اسم العضو والبريد الإلكتروني."
        : "Bitte Name und E-Mail eingeben."
    );
    return;
  }

  const fee = Number(monthlyFee);

  if (!Number.isFinite(fee) || fee < 0) {
    setMessage(
      ar ? "قيمة الاشتراك غير صحيحة." : "Ungültiger Mitgliedsbeitrag."
    );
    return;
  }

  setLoading(true);

  try {
    // الحصول على جلسة المدير
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError || !sessionData.session) {
      throw new Error(
        ar ? "يرجى تسجيل الدخول أولاً." : "Bitte zuerst anmelden."
      );
    }

    // إرسال بيانات العضو إلى الخادم لإرسال الدعوة
    const response = await fetch("/api/admin/invite-member", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionData.session.access_token}`,
      },
      body: JSON.stringify({
        name: name.trim(),
        email: email.trim(),
        monthlyFee: fee,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.error ||
          (ar ? "تعذرت إضافة العضو." : "Mitglied konnte nicht hinzugefügt werden.")
      );
    }

    setName("");
    setEmail("");
    setMonthlyFee("250");

    setMessage(
      ar
        ? "تمت إضافة العضو وإرسال دعوة إلى بريده الإلكتروني."
        : "Mitglied hinzugefügt und Einladung per E-Mail gesendet."
    );

    await loadMembers();
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    setMessage(
      `${ar ? "تعذرت إضافة العضو" : "Mitglied konnte nicht hinzugefügt werden"}: ${errorMessage}`
    );
  } finally {
    setLoading(false);
  }
}
async function generateMonthlyPayments() {
  if (!month) {
    setMessage(ar ? "اختر الشهر أولاً." : "Bitte zuerst einen Monat auswählen.");
    return;
  }

  const confirmed = window.confirm(
    ar
      ? `هل تريد إنشاء اشتراكات شهر ${month} لجميع الأعضاء؟`
      : `Monatsbeiträge für ${month} für alle Mitglieder erstellen?`
  );

  if (!confirmed) return;

  setLoading(true);
  setMessage("");

  try {
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError || !sessionData.session) {
      throw new Error(
        ar ? "يرجى تسجيل الدخول أولاً." : "Bitte zuerst anmelden."
      );
    }

    const response = await fetch(
      "/api/admin/generate-monthly-payments",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({ month }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "حدث خطأ");
    }

    setMessage(
      ar
        ? `تم إنشاء ${result.created} اشتراكًا للشهر ${month}.`
        : `${result.created} Beiträge für ${month} erstellt.`
    );

    await loadPayments();
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    setMessage(
      `${ar ? "تعذر إنشاء الاشتراكات" : "Beiträge konnten nicht erstellt werden"}: ${errorMessage}`
    );
  } finally {
    setLoading(false);
  }
}

  async function togglePayment(member: Member) {
    if (!member.is_active) {
  alert(ar ? "هذا العضو موقوف." : "Dieses Mitglied ist deaktiviert.");
  return;
}
  setMessage("");
  const payment = payments.find((p) => p.member_id === member.id);
  const newPaidState = !payment?.is_paid;

  setLoading(true);
  let error;

  if (payment) {
    const result = await supabase
      .from("monthly_payments")
      .update({
        is_paid: newPaidState,
        amount: member.monthlyFee,
        paid_at: newPaidState ? new Date().toISOString() : null,
      })
      .eq("id", payment.id);

    error = result.error;
  } else {
    const result = await supabase.from("monthly_payments").insert({
      member_id: member.id,
      member_name: member.name,
      member_email: member.email,
      payment_month: monthDate(month),
      amount: member.monthlyFee,
      is_paid: newPaidState,
      paid_at: newPaidState ? new Date().toISOString() : null,
    });

    error = result.error;
  }

  setLoading(false);

  if (error) {
    setMessage(
      `${ar ? "تعذر تحديث الدفعة" : "Zahlung konnte nicht aktualisiert werden"}: ${error.message}`
    );
    return;
  }

  setMessage(
    newPaidState
      ? ar
        ? "تم تأكيد الدفع."
        : "Zahlung bestätigt."
      : ar
        ? "تم إلغاء تأكيد الدفع."
        : "Zahlungsbestätigung zurückgenommen."
  );

  await loadPayments();
}

  async function addTransaction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const amount = Number(transactionAmount);

    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !transactionDescription.trim() ||
      !transactionDate
    ) {
      setMessage(
        ar
          ? "أدخل المبلغ والوصف والتاريخ بشكل صحيح."
          : "Bitte Betrag, Beschreibung und Datum korrekt eingeben."
      );
      return;
    }

    setLoading(true);
    const { error } = await supabase.from("financial_transactions").insert({
      transaction_type: transactionType,
      amount,
      description: transactionDescription.trim(),
      category: transactionCategory.trim() || null,
      transaction_date: transactionDate,
    });
    setLoading(false);

    if (error) {
      setMessage(
        `${ar ? "تعذرت إضافة الحركة المالية" : "Finanzbuchung konnte nicht hinzugefügt werden"}: ${error.message}`
      );
      return;
    }

    setTransactionAmount("");
    setTransactionDescription("");
    setTransactionCategory("");
    setMessage(
      ar ? "تمت إضافة الحركة المالية." : "Finanzbuchung hinzugefügt."
    );
    await loadTransactions();
  }

  async function deleteTransaction(id: number) {
    if (
      !window.confirm(
        ar
          ? "هل تريد حذف هذه الحركة المالية؟"
          : "Diese Finanzbuchung löschen?"
      )
    ) {
      return;
    }

    const { error } = await supabase
      .from("financial_transactions")
      .delete()
      .eq("id", id);

    if (error) {
      setMessage(
        `${ar ? "تعذر الحذف" : "Löschen fehlgeschlagen"}: ${error.message}`
      );
      return;
    }

    setMessage(ar ? "تم حذف الحركة." : "Buchung gelöscht.");
    await loadTransactions();
  }
  async function setMemberStatus(member: Member, isActive: boolean) {
    const actionText = isActive
      ? "إعادة تفعيل العضو"
      : "إيقاف العضو";

    if (
      !window.confirm(
        ar
          ? `هل تريد ${actionText} ${member.name}؟`
          : `Möchten Sie ${member.name} wirklich ${
              isActive ? "reaktivieren" : "deaktivieren"
            }?`
      )
    ) {
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError || !sessionData.session) {
        throw new Error(
          ar ? "يرجى تسجيل الدخول أولاً." : "Bitte zuerst anmelden."
        );
      }

      const response = await fetch("/api/admin/set-member-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          memberId: member.id,
          isActive,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "حدث خطأ.");
      }

      setMessage(
        ar
          ? isActive
            ? "تمت إعادة تفعيل العضو."
            : "تم إيقاف العضو."
          : isActive
            ? "Mitglied reaktiviert."
            : "Mitglied deaktiviert."
      );

      await loadMembers();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "حدث خطأ غير متوقع."
      );
    } finally {
      setLoading(false);
    }
  }


  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const paidMemberIds = new Set(
    payments
      .filter((payment) => payment.is_paid)
      .map((payment) => payment.member_id)
  );

  const paidCount = members.filter((member) =>
    paidMemberIds.has(member.id)
  ).length;

  const unpaidCount = members.length - paidCount;

  const expectedTotal = members.reduce(
    (sum, member) => sum + member.monthlyFee,
    0
  );

  const paidTotal = members
    .filter((member) => paidMemberIds.has(member.id))
    .reduce((sum, member) => sum + member.monthlyFee, 0);

  const incomeTotal = transactions
    .filter((item) => item.transaction_type === "income")
    .reduce((sum, item) => sum + item.amount, 0);

  const expenseTotal = transactions
    .filter((item) => item.transaction_type === "expense")
    .reduce((sum, item) => sum + item.amount, 0);

  function exportExcel() {
    const summary = [
      {
        [ar ? "البيان" : "Position"]: ar ? "الشهر" : "Monat",
        [ar ? "القيمة" : "Wert"]: month,
      },
      {
        [ar ? "البيان" : "Position"]: ar ? "عدد الأعضاء" : "Mitglieder",
        [ar ? "القيمة" : "Wert"]: members.length,
      },
      {
        [ar ? "البيان" : "Position"]: ar ? "المدفوع" : "Bezahlt",
        [ar ? "القيمة" : "Wert"]: paidTotal,
      },
      {
        [ar ? "البيان" : "Position"]: ar ? "المتوقع" : "Erwartet",
        [ar ? "القيمة" : "Wert"]: expectedTotal,
      },
      {
        [ar ? "البيان" : "Position"]: ar ? "الإيرادات" : "Einnahmen",
        [ar ? "القيمة" : "Wert"]: incomeTotal,
      },
      {
        [ar ? "البيان" : "Position"]: ar ? "المصروفات" : "Ausgaben",
        [ar ? "القيمة" : "Wert"]: expenseTotal,
      },
    ];

    const memberRows = members.map((member) => ({
      ID: member.id,
      [ar ? "الاسم" : "Name"]: member.name,
      Email: member.email,
      [ar ? "الاشتراك الشهري" : "Monatsbeitrag"]: member.monthlyFee,
      [ar ? "حالة الدفع" : "Zahlungsstatus"]: paidMemberIds.has(member.id)
        ? ar
          ? "مدفوع"
          : "Bezahlt"
        : ar
          ? "غير مدفوع"
          : "Offen",
    }));

    const transactionRows = transactions.map((item) => ({
      Datum: item.transaction_date,
      Typ: item.transaction_type,
      Betrag: item.amount,
      Beschreibung: item.description,
      Kategorie: item.category ?? "",
    }));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(summary),
      "Summary"
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(memberRows),
      "Members"
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(transactionRows),
      "Transactions"
    );
    XLSX.writeFile(workbook, `Mitglieder-${month}.xlsx`);
  }

  if (authChecking) {
    return (
      <main style={{ padding: 32, textAlign: "center" }}>
        {ar
          ? "جارٍ التحقق من تسجيل الدخول..."
          : "Anmeldung wird geprüft..."}
      </main>
    );
  }

  return (
    <main
      dir={ar ? "rtl" : "ltr"}
      style={{
        width: "100%",
        maxWidth: "none",
        boxSizing: "border-box",
        margin: 0,
        padding: 24,
        fontFamily: "Arial, sans-serif",
        color: colors.dark,
        background: "#f8fafc",
        minHeight: "100vh",
      }}
    >
      <header
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h1>
            {ar
              ? "إدارة الأعضاء والاشتراكات"
              : "Mitglieder- und Beitragsverwaltung"}
          </h1>
          <p>{ar ? "لوحة تحكم المدير" : "Administrationsbereich"}</p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            style={{ ...buttonStyle, background: colors.blue }}
            onClick={() => setLanguage(ar ? "de" : "ar")}
          >
            {ar ? "Deutsch" : "العربية"}
          </button>
          <button
            style={{ ...buttonStyle, background: colors.blue }}
            onClick={exportExcel}
          >
            {ar ? "تصدير Excel" : "Excel exportieren"}
          </button>
          <button
            style={{ ...buttonStyle, background: colors.dark }}
            onClick={logout}
          >
            {ar ? "تسجيل الخروج" : "Abmelden"}
          </button>
        </div>
      </header>

      {message && (
        <p
          role="status"
          style={{
            background: "#e0f2fe",
            color: "#075985",
            padding: 12,
            borderRadius: 8,
            overflowWrap: "anywhere",
          }}
        >
          {message}
        </p>
      )}

      <section style={{ marginTop: 24 }}>
        <label>
          {ar ? "الشهر" : "Monat"}{" "}
          <input
            style={{ ...inputStyle, width: "auto" }}
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          marginTop: 20,
        }}
      >
        <SummaryCard title={ar ? "عدد الأعضاء" : "Mitglieder"} value={String(members.length)} />
        <SummaryCard title={ar ? "دفعوا الاشتراك" : "Bezahlt"} value={String(paidCount)} />
        <SummaryCard title={ar ? "لم يدفعوا" : "Offen"} value={String(unpaidCount)} />
        <SummaryCard title={ar ? "المبالغ المحصلة" : "Eingegangene Beiträge"} value={euro(paidTotal)} />
        <SummaryCard title={ar ? "الإيرادات المسجلة" : "Erfasste Einnahmen"} value={euro(incomeTotal)} />
        <SummaryCard title={ar ? "المصروفات المسجلة" : "Erfasste Ausgaben"} value={euro(expenseTotal)} />
        <SummaryCard title={ar ? "صافي الحركات المالية" : "Finanzsaldo"} value={euro(incomeTotal - expenseTotal)} />
      </section>

      <section
        style={{
          marginTop: 32,
          background: "#fff",
          padding: 18,
          borderRadius: 12,
          border: "1px solid #e2e8f0",
        }}
      >
        <h2>{ar ? "إضافة عضو جديد" : "Neues Mitglied hinzufügen"}</h2>
        <form
          onSubmit={addMember}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          <input
            style={inputStyle}
            required
            placeholder={ar ? "اسم العضو" : "Name"}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            style={inputStyle}
            required
            type="email"
            placeholder={ar ? "البريد الإلكتروني" : "E-Mail"}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            style={inputStyle}
            required
            type="number"
            min="0"
            step="0.01"
            placeholder={ar ? "الاشتراك الشهري (€)" : "Monatsbeitrag (€)"}
            value={monthlyFee}
            onChange={(e) => setMonthlyFee(e.target.value)}
          />
          <button
            style={{ ...buttonStyle, background: colors.purple }}
            type="submit"
            disabled={loading}
          >
            {ar ? "إضافة العضو" : "Mitglied hinzufügen"}
          </button>
        </form>
      </section>

      <section
        style={{
          marginTop: 32,
          background: "#fff",
          padding: 18,
          borderRadius: 12,
          border: "1px solid #e2e8f0",
        }}
      >
        <h2>{ar ? "الاشتراكات الشهرية" : "Monatliche Beiträge"}</h2>
        <button
  style={{ ...buttonStyle, background: colors.purple, marginBottom: 16 }}
  type="button"
  disabled={loading || !month}
  onClick={() => void generateMonthlyPayments()}
>
  {ar ? `إنشاء اشتراكات شهر ${month}` : `Beiträge für ${month} erstellen`}
</button>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={cellStyle}>{ar ? "الاسم" : "Name"}</th>
                <th style={cellStyle}>Email</th>
                <th style={cellStyle}>{ar ? "الاشتراك" : "Beitrag"}</th>
                <th style={cellStyle}>{ar ? "الحالة" : "Status"}</th>
                <th style={cellStyle}>{ar ? "الإجراء" : "Aktion"}</th>
<th style={cellStyle}>{ar ? "حالة العضوية" : "Mitgliedsstatus"}</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const isPaid = paidMemberIds.has(member.id);

                return (
                  <tr key={member.id}>
                    <td style={cellStyle}>{member.name}</td>
                    <td style={cellStyle}>{member.email}</td>
                    <td style={cellStyle}>{euro(member.monthlyFee)}</td>
                    <td
                      style={{
                        ...cellStyle,
                        color: isPaid ? "#166534" : "#991b1b",
                        background: isPaid ? "#dcfce7" : "#fee2e2",
                        fontWeight: 700,
                      }}
                    >
                      {isPaid
                        ? ar
                          ? "مدفوع"
                          : "Bezahlt"
                        : ar
                          ? "غير مدفوع"
                          : "Offen"}
                    </td>
                    <td style={cellStyle}>
                      <button
                        style={{
                          ...buttonStyle,
                          background: isPaid ? colors.red : colors.green,
                        }}
                        disabled={loading || !member.is_active}
                        onClick={() => void togglePayment(member)}
                      >
                        {isPaid
                          ? ar
                            ? "إلغاء التأكيد"
                            : "Bestätigung aufheben"
                          : ar
                            ? "تأكيد الدفع"
                            : "Zahlung bestätigen"}
                      </button>
                    </td>
                                        <td style={cellStyle}>
                      <button
                        style={{
                          ...buttonStyle,
                          background: member.is_active
                            ? colors.red
                            : colors.green,
                        }}
                        disabled={loading}
                        onClick={() =>
                          void setMemberStatus(member, !member.is_active)
                        }
                      >
                        {member.is_active
                          ? ar
                            ? "إيقاف العضو"
                            : "Deaktivieren"
                          : ar
                            ? "إعادة التفعيل"
                            : "Reaktivieren"}
                      </button>
                    </td>
                  </tr>
                );
              })}

              {members.length === 0 && (
                <tr>
                  <td style={cellStyle} colSpan={6}>
                    {ar
                      ? "لا يوجد أعضاء حتى الآن."
                      : "Noch keine Mitglieder vorhanden."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section
        style={{
          marginTop: 36,
          background: "#fff",
          padding: 18,
          borderRadius: 12,
          border: "1px solid #e2e8f0",
        }}
      >
        <h2>{ar ? "إضافة إيراد أو مصروف" : "Einnahme oder Ausgabe erfassen"}</h2>
        <form
          onSubmit={addTransaction}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          <select
            style={{
              ...inputStyle,
              borderColor: transactionType === "income" ? colors.green : colors.orange,
              fontWeight: 700,
            }}
            value={transactionType}
            onChange={(e) =>
              setTransactionType(e.target.value as "income" | "expense")
            }
          >
            <option value="income">{ar ? "إيراد" : "Einnahme"}</option>
            <option value="expense">{ar ? "مصروف" : "Ausgabe"}</option>
          </select>

          <input
            style={inputStyle}
            required
            type="number"
            min="0.01"
            step="0.01"
            placeholder={ar ? "المبلغ (€)" : "Betrag (€)"}
            value={transactionAmount}
            onChange={(e) => setTransactionAmount(e.target.value)}
          />
          <input
            style={inputStyle}
            required
            placeholder={ar ? "الوصف" : "Beschreibung"}
            value={transactionDescription}
            onChange={(e) => setTransactionDescription(e.target.value)}
          />
          <input
            style={inputStyle}
            placeholder={ar ? "الفئة (اختياري)" : "Kategorie (optional)"}
            value={transactionCategory}
            onChange={(e) => setTransactionCategory(e.target.value)}
          />
          <input
            style={inputStyle}
            required
            type="date"
            value={transactionDate}
            onChange={(e) => setTransactionDate(e.target.value)}
          />

          <button
            style={{
              ...buttonStyle,
              background: transactionType === "income" ? colors.green : colors.orange,
            }}
            type="submit"
            disabled={loading}
          >
            {ar ? "حفظ الحركة" : "Buchung speichern"}
          </button>
        </form>
      </section>

      <section
        style={{
          marginTop: 24,
          background: "#fff",
          padding: 18,
          borderRadius: 12,
          border: "1px solid #e2e8f0",
        }}
      >
        <h2>{ar ? "الحركات المالية لهذا الشهر" : "Finanzbuchungen dieses Monats"}</h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={cellStyle}>{ar ? "التاريخ" : "Datum"}</th>
                <th style={cellStyle}>{ar ? "النوع" : "Typ"}</th>
                <th style={cellStyle}>{ar ? "الوصف" : "Beschreibung"}</th>
                <th style={cellStyle}>{ar ? "الفئة" : "Kategorie"}</th>
                <th style={cellStyle}>{ar ? "المبلغ" : "Betrag"}</th>
                <th style={cellStyle}>{ar ? "إجراء" : "Aktion"}</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((item) => {
                const isIncome = item.transaction_type === "income";

                return (
                  <tr key={item.id}>
                    <td style={cellStyle}>{item.transaction_date}</td>
                    <td
                      style={{
                        ...cellStyle,
                        color: isIncome ? "#166534" : "#c2410c",
                        background: isIncome ? "#dcfce7" : "#ffedd5",
                        fontWeight: 700,
                      }}
                    >
                      {isIncome
                        ? ar
                          ? "إيراد"
                          : "Einnahme"
                        : ar
                          ? "مصروف"
                          : "Ausgabe"}
                    </td>
                    <td style={cellStyle}>{item.description}</td>
                    <td style={cellStyle}>{item.category ?? "—"}</td>
                    <td
                      style={{
                        ...cellStyle,
                        color: isIncome ? "#166534" : "#c2410c",
                        fontWeight: 700,
                      }}
                    >
                      {euro(item.amount)}
                    </td>
                    <td style={cellStyle}>
                      <button
                        style={{ ...buttonStyle, background: colors.red }}
                        onClick={() => void deleteTransaction(item.id)}
                      >
                        {ar ? "حذف" : "Löschen"}
                      </button>
                    </td>
                  </tr>
                );
              })}

              {transactions.length === 0 && (
                <tr>
                  <td style={cellStyle} colSpan={6}>
                    {ar
                      ? "لا توجد حركات مالية لهذا الشهر."
                      : "Keine Buchungen in diesem Monat."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function SummaryCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div
      style={{
        border: "1px solid #dbe3ee",
        borderRadius: 12,
        padding: 16,
        background: "#ffffff",
        boxShadow: "0 2px 7px rgba(0,0,0,0.04)",
      }}
    >
      <div style={{ color: "#555", marginBottom: 8 }}>{title}</div>
      <strong style={{ fontSize: 22 }}>{value}</strong>
    </div>
  );
}  