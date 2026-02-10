import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type TokenRequest = {
  token?: string;
};

const rateState = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, limit = 60, windowMs = 60_000) {
  const now = Date.now();
  const current = rateState.get(key);
  if (!current || now > current.resetAt) {
    rateState.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (current.count >= limit) {
    return false;
  }
  current.count += 1;
  return true;
}

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    if (!checkRateLimit(`token:${ip}`)) {
      return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });
    }

    const body = (await request.json()) as TokenRequest;
    const token = body.token?.trim();

    if (!token || token.length < 16) {
      return NextResponse.json({ error: "Invalid token." }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();
    const { data: vault, error: vaultError } = await supabase
      .from("vaults")
      .select("id, name, description, is_public, allow_downloads, created_at")
      .eq("share_token", token)
      .single();

    if (vaultError || !vault) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    const { data: files, error: filesError } = await supabase
      .from("vault_files")
      .select("id, original_name, size_bytes, sort_index, created_at, deleted_at")
      .eq("vault_id", vault.id)
      .is("deleted_at", null)
      .order("sort_index", { ascending: true })
      .order("created_at", { ascending: true });

    if (filesError) {
      console.error("TOKEN FILES ERROR:", filesError);
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    return NextResponse.json({ vault, files });
  } catch (error) {
    console.error("TOKEN ROUTE ERROR:", error);
    return NextResponse.json({ error: "Access failed." }, { status: 500 });
  }
}
