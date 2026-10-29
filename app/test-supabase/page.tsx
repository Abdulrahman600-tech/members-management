 
"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function TestSupabasePage() {
  const [result, setResult] = useState("لم يتم الاختبار بعد");
  const [details, setDetails] = useState("");

  async function testConnection() {
    setResult("جارٍ الاتصال...");
    setDetails("");

    const { data, error } = await supabase
      .from("members")
      .select("*")
      .limit(10);

    if (error) {
      setResult("الاتصال يحتاج إلى مراجعة");
      setDetails(error.message);
      return;
    }

    setResult("نجح الاتصال بجدول الأعضاء!");
    setDetails(
      `عدد السجلات التي تمت قراءتها: ${data.length}`
    );
  }

  return (
    <main className="p-8" dir="rtl">
      <h1 className="mb-4 text-2xl font-bold">
        اختبار الاتصال بقاعدة البيانات
      </h1>

      <button
        onClick={testConnection}
        className="rounded bg-blue-600 px-4 py-2 text-white"
      >
        اختبار الاتصال
      </button>

      <p className="mt-4 font-bold">{result}</p>

      {details && (
        <p className="mt-2 whitespace-pre-wrap">{details}</p>
      )}
    </main>
  );
}
