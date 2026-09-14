import { completeOAuthCallback } from "@/lib/auth/oauth-callback";

export async function GET(request: Request) {
  return completeOAuthCallback(request, "/account");
}
