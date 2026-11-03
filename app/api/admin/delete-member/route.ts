import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const ADMIN_UID = "56ac1884-fcdb-469a-9531-294b2364e71f";

export async function POST(request: NextRequest) {
  try {
    // 1. التحقق من هوية المدير
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

    // 2. التحقق من رقم العضو
    const body = await request.json();
    const memberId = Number(body.memberId);

    if (!Number.isSafeInteger(memberId) || memberId <= 0) {
      return NextResponse.json(
        { error: "رقم العضو غير صحيح." },
        { status: 400 }
      );
    }

    // 3. استخدام صلاحيات الإدارة على الخادم
    const admin = getSupabaseAdmin();

    const { data: member, error: findError } = await admin
      .from("members")
      .select("id, name, email, auth_user_id")
      .eq("id", memberId)
      .maybeSingle();

    if (findError) {
      return NextResponse.json(
        { error: findError.message },
        { status: 500 }
      );
    }

    if (!member) {
      return NextResponse.json(
        { error: "لم يتم العثور على العضو." },
        { status: 404 }
      );
    }

    // منع حذف حساب المدير نفسه
    if (member.auth_user_id === ADMIN_UID) {
      return NextResponse.json(
        { error: "لا يمكن حذف حساب المدير." },
        { status: 400 }
      );
    }

    // 4. حذف حساب الدخول إن كان مرتبطًا بالعضو
    if (member.auth_user_id) {
      const { error: deleteAuthError } =
        await admin.auth.admin.deleteUser(member.auth_user_id);

      if (deleteAuthError) {
        // إذا كان حساب الدخول محذوفًا مسبقًا، نتحقق من ذلك
        const { data: existingUser, error: getUserError } =
          await admin.auth.admin.getUserById(member.auth_user_id);

        if (existingUser?.user) {
          return NextResponse.json(
            { error: deleteAuthError.message },
            { status: 500 }
          );
        }

        if (getUserError && getUserError.status !== 404) {
          return NextResponse.json(
            { error: getUserError.message },
            { status: 500 }
          );
        }
      }
    }

    // 5. حذف سجل العضو فقط
    // لا نحذف أي سجل من monthly_payments
    const { error: deleteMemberError } = await admin
      .from("members")
      .delete()
      .eq("id", memberId);

    if (deleteMemberError) {
      return NextResponse.json(
        {
          error:
            "تم التعامل مع حساب الدخول، لكن تعذر حذف سجل العضو: " +
            deleteMemberError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "تم حذف العضو وحساب دخوله مع الاحتفاظ بسجلات الدفعات.",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "حدث خطأ غير متوقع.";

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}