import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

function getCurrentMonthGermany() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;

  return `${year}-${month}-01`;
}

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("Authorization");

    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice(7)
      : null;

    if (!token) {
      return NextResponse.json(
        { error: "يجب تسجيل الدخول أولاً." },
        { status: 401 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: "إعدادات الاتصال بقاعدة البيانات غير مكتملة." },
        { status: 500 }
      );
    }

    // التحقق من جلسة المستخدم
    const authClient = createClient(supabaseUrl, supabaseAnonKey);

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: "جلسة الدخول غير صالحة." },
        { status: 401 }
      );
    }

    // التحقق من العضوية ونشاط الحساب
    const admin = getSupabaseAdmin();

    const { data: member, error: memberError } = await admin
      .from("members")
      .select("id, is_active")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (memberError || !member || !member.is_active) {
      return NextResponse.json(
        { error: "العضوية غير موجودة أو غير نشطة." },
        { status: 403 }
      );
    }

    // الشهر الحالي حسب توقيت ألمانيا
    const paymentMonth = getCurrentMonthGermany();

    const { data: payment, error: paymentError } = await admin
      .from("monthly_payments")
      .select("id, is_paid, member_reported")
      .eq("member_id", member.id)
      .eq("payment_month", paymentMonth)
      .maybeSingle();

    if (paymentError) {
      console.error("Find payment error:", paymentError);

      return NextResponse.json(
        { error: "تعذر التحقق من سجل الدفع." },
        { status: 500 }
      );
    }

    if (!payment) {
      return NextResponse.json(
        { error: "لا يوجد سجل دفع لهذا الشهر حتى الآن." },
        { status: 404 }
      );
    }

    if (payment.is_paid) {
      return NextResponse.json(
        { error: "تم تأكيد دفع هذا الشهر بالفعل." },
        { status: 400 }
      );
    }

    if (payment.member_reported) {
      return NextResponse.json(
        { message: "لقد أبلغت عن الدفع مسبقاً." },
        { status: 200 }
      );
    }

    // تسجيل إبلاغ العضو عن الدفع
    const { data: updatedPayment, error: updateError } = await admin
      .from("monthly_payments")
      .update({
        member_reported: true,
        member_reported_at: new Date().toISOString(),
      })
      .eq("id", payment.id)
      .eq("member_id", member.id)
      .eq("is_paid", false)
      .select("id")
      .maybeSingle();

    if (updateError) {
      console.error("Update payment report error:", updateError);

      return NextResponse.json(
        { error: "تعذر إرسال إشعار الدفع." },
        { status: 500 }
      );
    }

    if (!updatedPayment) {
      return NextResponse.json(
        { error: "تعذر تسجيل الإبلاغ. ربما تم تأكيد الدفع بالفعل." },
        { status: 409 }
      );
    }

    return NextResponse.json({
      message: "تم إرسال إشعار الدفع إلى الإدارة بنجاح.",
    });
  } catch (error) {
    console.error("Report payment error:", error);

    return NextResponse.json(
      { error: "حدث خطأ غير متوقع." },
      { status: 500 }
    );
  }
}