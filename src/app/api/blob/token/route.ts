import { auth } from "@/lib/auth";

// IMPORTANT: types differ across @vercel/blob versions.
// We import dynamically and use `any` to avoid TS mismatch.
export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await auth().catch(() => null);
  if (!session?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const mod: any = await import("@vercel/blob/client");
    const handleUpload: any = mod.handleUpload;

    // handleUpload returns a Response — do NOT wrap it in NextResponse.json()
    return handleUpload({
      request,
      onBeforeGenerateToken: async (_pathname: string) => {
        return {
          allowedContentTypes: [
            "audio/mpeg",
            "audio/wav",
            "audio/mp4",
            "audio/x-m4a",
            "video/mp4",
            "video/quicktime",
            "video/webm",
            "application/pdf",
            "text/plain",
          ],
          maximumSizeInBytes: 1024 * 1024 * 500, // 500MB
          tokenPayload: JSON.stringify({ userEmail: (session?.user as any)?.email ?? "" }),
        };
      },
      onUploadCompleted: async (_evt: any) => {
        // optional: persist _evt.blob?.url to DB later
      },
    } as any);
  } catch (err: any) {
    console.error("Blob token route error:", err);
    return new Response(
      JSON.stringify({ error: "Upload token failed", details: err?.message ?? String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
