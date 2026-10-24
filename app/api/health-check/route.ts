import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { ai } from "@/lib/gemini";

export async function GET() {
  try {
    const isFirebaseReady = Boolean(db);
    const isGeminiReady = Boolean(ai);

    return NextResponse.json({
      status: "ok",
      firebase: isFirebaseReady,
      gemini: isGeminiReady,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        firebase: false,
        gemini: false,
        error: error instanceof Error ? error.message : "Health check failed",
      },
      { status: 500 }
    );
  }
}
