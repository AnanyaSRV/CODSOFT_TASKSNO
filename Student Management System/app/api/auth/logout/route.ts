import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const response = NextResponse.redirect(
    new URL("/", request.url),
    { status: 303 }
  );

  response.cookies.set("edumanage-session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}