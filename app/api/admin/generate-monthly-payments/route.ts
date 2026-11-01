import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const ADMIN_UID = "56ac1884-fcdb-469a-9531-294b2364e71f";

const supabaseAuth = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("Authorization");

    if (!authorization || !authorization.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "غير مصرح بالدخول" },
        { status: 401 }
      );
    }

    const token = authorization.slice(7);

    const { data: authData, error: authError } =
      await supabaseAuth.auth.getUser(token);

    if (authError || authData.user?.id !== ADMIN_UID) {
      return NextResponse.json(
        { error: "هذه العملية متاحة للمدير فقط" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const month = String(body.month || "");

    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return NextResponse.json(
        { error: "صيغة الشهر غير صحيحة" },
        { status: 400 }
      );
    }

    const paymentMonth = month + "-01";
    const supabaseAdmin = getSupabaseAdmin();

    // جلب الأعضاء النشطين فقط
    const { data: members, error: membersError } =
      await supabaseAdmin
        .from("members")
        .select("id, name, email, monthly_fee, is_active")
        .eq("is_active", true);

    if (membersError) {
      throw membersError;
    }

    // جلب الاشتراكات الموجودة لهذا الشهر
    const { data: existingPayments, error: paymentsError } =
      await supabaseAdmin
        .from("monthly_payments")
        .select("member_id")
        .eq("payment_month", paymentMonth);

    if (paymentsError) {
      throw paymentsError;
    }

    const existingIds = new Set(
      (existingPayments || [])
        .map((payment) => payment.member_id)
        .filter((id) => id !== null)
        .map((id) => Number(id))
    );

    // إنشاء اشتراكات جديدة للأعضاء النشطين فقط
    const newPayments = (members || [])
      .filter(
        (member) => !existingIds.has(Number(member.id))
      )
      .map((member) => ({
        member_id: member.id,
        member_name: member.name,
        member_email: member.email,
        payment_month: paymentMonth,
        amount: Number(member.monthly_fee),
        is_paid: false,
      }));

    if (newPayments.length === 0) {
      return NextResponse.json({
        success: true,
        created: 0,
        message: "لا توجد اشتراكات جديدة لإنشائها",
      });
    }

    const { error: insertError } = await supabaseAdmin
      .from("monthly_payments")
      .insert(newPayments);

    if (insertError) {
      throw insertError;
    }

    return NextResponse.json({
      success: true,
      created: newPayments.length,
      message:
        "تم إنشاء " + newPayments.length + " اشتراكًا بنجاح",
    });
  } catch (error) {
    console.error("Generate monthly payments error:", error);

    return NextResponse.json(
      { error: "حدث خطأ أثناء إنشاء الاشتراكات الشهرية" },
      { status: 500 }
    );
  }
}