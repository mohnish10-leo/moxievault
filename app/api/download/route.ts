import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getUserIdFromAuthHeader } from "@/lib/supabaseServerAuth";

export const runtime = "nodejs";

type DownloadRequest = {
  vaultFileId?: string;
  shareToken?: string | null;
  expiresIn?: number;
};

const rateState = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, limit = 30, windowMs = 60_000) {
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
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    if (!checkRateLimit(`download:${ip}`)) {
      return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });
    }

    const body = (await request.json()) as DownloadRequest;
    const vaultFileId = body.vaultFileId?.trim();
    const shareToken = body.shareToken?.trim() || null;
    const expiresIn = Math.min(Math.max(body.expiresIn ?? 300, 60), 3600);

    if (!vaultFileId || !/^[0-9a-f-]{36}$/i.test(vaultFileId)) {
      return NextResponse.json(
        { error: "Invalid vaultFileId." },
        { status: 400 }
      );
    }

    const requestingUserId = await getUserIdFromAuthHeader(
      request.headers.get("authorization")
    );

    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase.rpc("authorize_file_download", {
      p_requesting_user: requestingUserId,
      p_vault_file_id: vaultFileId,
      p_share_token: shareToken,
    });

    if (error) {
      console.error("AUTHORIZE RPC ERROR:", error);
      return NextResponse.json(
        { error: "Authorization failed.", detail: error.message, code: error.code },
        { status: 500 }
      );
    }

    const record = Array.isArray(data) ? data[0] : data;
    if (!record?.allowed || !record.storage_path) {
      return NextResponse.json({ error: "Not allowed." }, { status: 403 });
    }

    const { data: signed, error: signError } = await supabase.storage
      .from("vault-files")
      .createSignedUrl(record.storage_path, expiresIn);

    if (signError || !signed?.signedUrl) {
      console.error("SIGNED URL ERROR:", signError);
      return NextResponse.json(
        { error: "Could not create signed URL." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      signedUrl: signed.signedUrl,
      originalName: record.original_name,
      vaultId: record.vault_id,
      expiresIn,
    });
  } catch (error) {
    console.error("DOWNLOAD ROUTE ERROR:", error);
    return NextResponse.json({ error: "Download failed." }, { status: 500 });
  }
}
