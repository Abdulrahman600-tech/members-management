
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const ADMIN_UID = "56ac1884-fcdb-469a-9531-294b2364e71f";

export async function POST(request: NextRequest) {
  try {
    // 1. التحقق من جلسة المدير
    const authorization = request.headers.get("Authorization");
    const token = authorization?.replace(/^Bearer\s+/i, "");

    if (!token) {
      return NextResponse.json(
        { error: "غير مصرح بالدخول." },
        { status: 401 }
      );
    }

    const { data: authData, error: authError } =
      await supabase.auth.getUser(token);

    if (
      authError ||
      !authData.user ||
      authData.user.id !== ADMIN_UID
    ) {
      return NextResponse.json(
        { error: "ليس لديك صلاحية تنفيذ هذه العملية." },
        { status: 403 }
      );
    }

    // 2. قراءة البيانات
    const body = await request.json();
    const memberId = Number(body.memberId);
    const isActive = body.isActive;

    if (
      !Number.isSafeInteger(memberId) ||
      memberId <= 0 ||
      typeof isActive !== "boolean"
    ) {
      return NextResponse.json(
        { error: "بيانات العضو غير صحيحة." },
        { status: 400 }
      );
    }

    // 3. استخدام صلاحيات الإدارة على الخادم
    const admin = getSupabaseAdmin();

    const { data: member, error: findError } = await admin
      .from("members")
      .select("id, auth_user_id, is_active")
      .eq("id", memberId)
      .maybeSingle();

    if (findError || !member) {
      return NextResponse.json(
        { error: "لم يتم العثور على العضو." },
        { status: 404 }
      );
    }

    if (member.is_active === isActive) {
      return NextResponse.json({
        success: true,
        message: "حالة العضو لم تتغير.",
      });
    }

    if (!member.auth_user_id) {
      return NextResponse.json(
        { error: "لا يوجد حساب دخول مرتبط بهذا العضو." },
        { status: 400 }
      );
    }

    // 4. تحديث حالة العضو في قاعدة البيانات
    const { error: updateError } = await admin
      .from("members")
      .update({ is_active: isActive })
      .eq("id", memberId);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    // 5. إيقاف حساب الدخول أو إعادة تفعيله
    const { error: authUpdateError } =
      await admin.auth.admin.updateUserById(
        member.auth_user_id,
        {
          ban_duration: isActive ? "none" : "876000h",
        }
      );

    // إذا فشل تحديث حساب الدخول، نعيد حالة العضو كما كانت
    if (authUpdateError) {
      await admin
        .from("members")
        .update({ is_active: member.is_active })
        .eq("id", memberId);

      return NextResponse.json(
        { error: authUpdateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: isActive
        ? "تمت إعادة تفعيل العضو."
        : "تم إيقاف العضو.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "حدث خطأ غير متوقع.";

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
