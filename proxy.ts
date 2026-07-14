import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "gph_session";
const encodedKey = new TextEncoder().encode(process.env.SESSION_SECRET);

// Rutas públicas (accesibles sin sesión).
const PUBLIC_PATHS = ["/login"];

async function hasValidSession(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return false;
  try {
    await jwtVerify(token, encodedKey, { algorithms: ["HS256"] });
    return true;
  } catch {
    return false;
  }
}

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const authed = await hasValidSession(req);

  // Usuario sin sesión que intenta entrar a una ruta protegida → login.
  if (!authed && !isPublic) {
    const url = new URL("/login", req.nextUrl);
    return NextResponse.redirect(url);
  }

  // Usuario con sesión que va a /login → panel.
  if (authed && isPublic) {
    return NextResponse.redirect(new URL("/panel", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  // Corre en todas las rutas excepto assets estáticos y la API interna de Next.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)"],
};
