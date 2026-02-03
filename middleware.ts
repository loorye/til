import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // 認証が無効化されている場合はスキップ
  if (process.env.DISABLE_AUTH === "true") {
    return NextResponse.next();
  }

  // 認証情報の取得
  const basicAuth = request.headers.get("authorization");

  if (basicAuth) {
    const authValue = basicAuth.split(" ")[1];
    const [user, pwd] = atob(authValue).split(":");

    const validUser = process.env.AUTH_USERNAME || "admin";
    const validPassword = process.env.AUTH_PASSWORD || "password";

    if (user === validUser && pwd === validPassword) {
      return NextResponse.next();
    }
  }

  // 認証失敗時は401を返す
  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Secure Area"',
    },
  });
}

export const config = {
  matcher: [
    /*
     * すべてのパスにマッチ、ただし以下を除く:
     * - api/auth (認証エンドポイント自体)
     * - _next/static (静的ファイル)
     * - _next/image (画像最適化ファイル)
     * - favicon.ico (ファビコン)
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};
