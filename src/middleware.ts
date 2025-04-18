import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/database/conection";
import UserTable from "@/modules/auth/table";
import { StudentLoginTable } from "./modules/auth-student/table";
import { User } from "@supabase/supabase-js";
import { JWTPayload, jwtVerify } from "jose";

const SIGN_IN_URL = "/sign-in";
const REFRESH_API_URL = "/api/auth/refresh";
const JWT_SECRET = process.env.JWT_SECRET!;
const secret = new TextEncoder().encode(JWT_SECRET);

async function refreshTokens() {
  // Hacerlo directamente, porque no se puede llamar apis desde el middleware
  const refreshResponse = await fetch(
    `http://localhost:3000${REFRESH_API_URL}`,
    {
      method: "POST",
      credentials: "include",
    }
  );

  if (!refreshResponse.ok) {
    return null;
  }

  const { access_token: newAccessToken, refresh_token: newRefreshToken } =
    await refreshResponse.json();

  const { data, error } = await supabase.auth.setSession({
    access_token: newAccessToken,
    refresh_token: newRefreshToken,
  });

  if (error) {
    return null;
  }

  return { newAccessToken, newRefreshToken, user: data.user };
}

async function handleUserAuth(req: NextRequest) {
  const accessToken = req.cookies.get("access_token")?.value;
  const refreshToken = req.cookies.get("refresh_token")?.value;

  let user = null;

  if (accessToken && refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) {
      return { authenticated: false, user: null };
    }

    user = data.user;
  } else if (!accessToken && refreshToken) {
    const tokens = await refreshTokens();
    if (!tokens) {
      return { authenticated: false, user: null };
    }
    user = tokens.user;
  } else {
    return { authenticated: false, user: null };
  }

  return { authenticated: true, user };
}

async function handleStudentAuth(req: NextRequest) {
  const studentToken = req.cookies.get("student_access_token")?.value;

  if (!studentToken) {
    return { authenticated: false, student: null };
  }

  try {
    const { payload } = await jwtVerify(studentToken, secret);

    if (!payload || typeof payload !== "object") {
      return { authenticated: false, student: null };
    }

    const { voucher_id, code } = payload as {
      voucher_id: string;
      code: string;
    };

    if (!voucher_id || !code) {
      return { authenticated: false, student: null };
    }

    const studentLoginTable = new StudentLoginTable();
    const sessionValid = await studentLoginTable.validateSession(
      voucher_id,
      code
    );

    if (!sessionValid) {
      return { authenticated: false, student: null };
    }

    return { authenticated: true, student: payload };
  } catch (error) {
    console.error("Student auth error:", error);
    return { authenticated: false, student: null };
  }
}

export async function middleware(req: NextRequest) {
  try {
    // Check for student_access_token first
    const hasStudentToken = req.cookies.has("student_access_token");

    // Authentication results
    let userAuthResult: { authenticated: boolean; user: User | null } = {
      authenticated: false,
      user: null,
    };
    let studentAuthResult: {
      authenticated: boolean;
      student: null | JWTPayload;
    } = { authenticated: false, student: null };

    // Try student authentication if token exists
    if (hasStudentToken) {
      studentAuthResult = await handleStudentAuth(req);
    }

    // If student auth failed, try user auth
    if (!studentAuthResult.authenticated) {
      userAuthResult = await handleUserAuth(req);
    }

    // If both auth methods failed and this is a protected route, redirect to sign in
    if (!studentAuthResult.authenticated && !userAuthResult.authenticated) {
      return NextResponse.redirect(new URL(SIGN_IN_URL, req.url));
    }

    // Set appropriate headers if this is an API route

    // For user API routes
    if (
      userAuthResult.authenticated &&
      req.nextUrl.pathname.startsWith("/app/api")
    ) {
      const userTable = new UserTable();
      const userData = await userTable.getByUuid(
        userAuthResult?.user?.id ?? ""
      );

      if (!userData) {
        return NextResponse.redirect(new URL(SIGN_IN_URL, req.url));
      }

      const userString = JSON.stringify(userData);
      const requestHeaders = new Headers(req.headers);
      requestHeaders.set("x-user", userString);

      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
    }

    // If we reach here, either authentication was successful or the route doesn't require it
    return NextResponse.next();
  } catch (error: any) {
    return NextResponse.json(
      { error: `Internal server error: ${error.message}` },
      { status: 500 }
    );
  }
}

export const config = {
  matcher: [
    "/((?!api/auth/register|api/auth/login|api/auth/refresh|sign-in|api/auth-student|api/decrypt-student|_next/static|_next/image|public|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp)$).*)",
  ],
};
