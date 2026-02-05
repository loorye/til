import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getParameter, PARAMETER_PATHS } from "@/lib/utils/parameter-store";

export async function middleware(request: NextRequest) {
  // Parameter Storeから認証設定を取得（環境変数フォールバック付き）
  const disableAuthValue = await getParameter(
    PARAMETER_PATHS.DISABLE_AUTH,
    "DISABLE_AUTH"
  );
  const validUser =
    (await getParameter(PARAMETER_PATHS.AUTH_USERNAME, "AUTH_USERNAME")) ||
    "admin";
  const validPassword =
    (await getParameter(PARAMETER_PATHS.AUTH_PASSWORD, "AUTH_PASSWORD")) ||
    "password";

  // デバッグログ（本番環境でのトラブルシューティング用）
  console.log("[auth] middleware invoked", {
    path: request.nextUrl.pathname,
    disableAuth: disableAuthValue,
    hasAuthHeader: !!request.headers.get("authorization"),
  });

  // 認証が無効化されている場合はスキップ
  if (disableAuthValue === "true") {
    console.log("[auth] authentication disabled");
    return NextResponse.next();
  }

  // 認証情報の取得
  const basicAuth = request.headers.get("authorization");

  if (basicAuth) {
    const authValue = basicAuth.split(" ")[1];
    const [user, pwd] = atob(authValue).split(":");

    console.log("[auth] authentication attempt", {
      providedUser: user,
      expectedUser: validUser,
      passwordMatch: pwd === validPassword,
    });

    if (user === validUser && pwd === validPassword) {
      console.log("[auth] authentication successful");
      return NextResponse.next();
    }
  }

  // 認証失敗時は401を返す
  console.log("[auth] authentication failed - returning 401");
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
