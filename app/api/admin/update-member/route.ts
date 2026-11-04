import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const ADMIN_UID = "56ac1884-fcdb-469a-9531-294b2364e71f";

export async function POST(request: Request) {
  try {
    // التحقق من جلسة المدير
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

    // التحقق من إعدادات Supabase
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !anonKey) {
      return NextResponse.json(
        { error: "إعدادات Supabase غير مكتملة." },
        { status: 500 }
      );
    }

    // التحقق من هوية المستخدم
    const authClient = createClient(url, anonKey);

    const {
      data: { user: adminUser },
      error: authError,
    } = await authClient.auth.getUser(token);

    if (authError || !adminUser || adminUser.id !== ADMIN_UID) {
      return NextResponse.json(
        { error: "غير مصرح لك بتنفيذ هذا الإجراء." },
        { status: 403 }
      );
    }

    // قراءة البيانات المرسلة
    const body = await request.json();

    const memberId = Number(body.memberId);
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const monthlyFee = Number(body.monthlyFee);

    // التحقق من صحة البيانات
    if (
      !Number.isSafeInteger(memberId) ||
      memberId <= 0 ||
      !name ||
      !email ||
      !Number.isFinite(monthlyFee) ||
      monthlyFee < 0 ||
      monthlyFee > 10000000
    ) {
      return NextResponse.json(
        { error: "بيانات العضو غير صحيحة." },
        { status: 400 }
      );
    }

    // التحقق من البريد الإلكتروني
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email)) {
      return NextResponse.json(
        { error: "البريد الإلكتروني غير صالح." },
        { status: 400 }
      );
    }

    // الاتصال الإداري بقاعدة البيانات
    const admin = getSupabaseAdmin();

    // البحث عن العضو
    const { data: member, error: memberError } = await admin
      .from("members")
      .select("id, name, email, auth_user_id")
      .eq("id", memberId)
      .maybeSingle();

    if (memberError) {
      console.error("Find member error:", memberError);

      return NextResponse.json(
        { error: "حدث خطأ أثناء البحث عن العضو." },
        { status: 500 }
      );
    }

    if (!member) {
      return NextResponse.json(
        { error: "لم يتم العثور على العضو." },
        { status: 404 }
      );
    }

    const oldEmail = member.email;

    // تحديث بريد حساب الدخول إذا كان العضو مرتبطاً بحساب Auth
    if (member.auth_user_id) {
      const { error: authUpdateError } =
        await admin.auth.admin.updateUserById(member.auth_user_id, {
          email,
        });

      if (authUpdateError) {
        console.error("Auth email update error:", authUpdateError);

        return NextResponse.json(
          {
            error:
              "تعذر تحديث بريد تسجيل الدخول: " +
              authUpdateError.message,
          },
          { status: 400 }
        );
      }
    }

    // تحديث بيانات العضو في جدول members
    const { error: updateError } = await admin
      .from("members")
      .update({
        name,
        email,
        monthly_fee: monthlyFee,
      })
      .eq("id", memberId);

    if (updateError) {
      console.error("Update member database error:", updateError);

      // محاولة إعادة بريد الدخول إلى قيمته السابقة
      if (member.auth_user_id && oldEmail) {
        const { error: rollbackError } =
          await admin.auth.admin.updateUserById(member.auth_user_id, {
            email: oldEmail,
          });

        if (rollbackError) {
          console.error("Email rollback error:", rollbackError);
        }
      }

      return NextResponse.json(
        {
          error:
            "تعذر تحديث بيانات العضو: " + updateError.message,
        },
        { status: 500 }
      );
    }

    // نجاح العملية
    return NextResponse.json({
      success: true,
      message: "تم تحديث بيانات العضو بنجاح.",
    });
  } catch (error) {
    console.error("Update member error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "حدث خطأ غير متوقع أثناء تعديل العضو.",
      },
      { status: 500 }
    );
  }
}