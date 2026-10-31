
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
    const supabaseAdmin = getSupabaseAdmin();

    // التحقق من هوية المدير
    const authorization = request.headers.get("Authorization");

    if (!authorization?.startsWith("Bearer ")) {
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

    // قراءة بيانات العضو
    const body = await request.json();
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const monthlyFee = Number(body.monthlyFee);

    if (
      !name ||
      !email ||
      !email.includes("@") ||
      !Number.isFinite(monthlyFee) ||
      monthlyFee < 0
    ) {
      return NextResponse.json(
        { error: "يرجى إدخال بيانات صحيحة" },
        { status: 400 }
      );
    }

    // منع تكرار البريد في جدول الأعضاء
    const { data: existingMember, error: checkError } =
      await supabaseAdmin
        .from("members")
        .select("id")
        .eq("email", email)
        .maybeSingle();

    if (checkError) throw checkError;

    if (existingMember) {
      return NextResponse.json(
        { error: "هذا البريد مسجل بالفعل ضمن الأعضاء" },
        { status: 409 }
      );
    }

    // إرسال دعوة إلى البريد الإلكتروني
    const { data: inviteData, error: inviteError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo:
          "https://members-management-khaki.vercel.app/set-password",
      });

    if (inviteError) throw inviteError;

    const userId = inviteData.user.id;

    // إضافة العضو إلى جدول members
    const { data: member, error: memberError } =
      await supabaseAdmin
        .from("members")
        .insert({
          name,
          email,
          monthly_fee: monthlyFee,
          auth_user_id: userId,
        })
        .select("id")
        .single();

    if (memberError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw memberError;
    }

    // منح الحساب صلاحية عضو عادي فقط
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: userId,
        role: "member",
      });

    if (roleError) {
      await supabaseAdmin
        .from("members")
        .delete()
        .eq("id", member.id);

      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw roleError;
    }

    return NextResponse.json({
      success: true,
      message: "تم إرسال دعوة العضو بنجاح",
    });

  } catch (error) {
    console.error("Invite member error:", error);

    return NextResponse.json(
      { error: "تعذر إرسال الدعوة أو إنشاء حساب العضو" },
      { status: 500 }
    );
  }
}
