import { toNextJsHandler } from "better-auth/next-js";
import { AuthConfigurationError, getAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handleAuthRequest = async (request: Request): Promise<Response> => {
  let auth: ReturnType<typeof getAuth>;
  try {
    auth = getAuth();
  } catch (error) {
    if (!(error instanceof AuthConfigurationError)) throw error;
    console.error("Authentication is not configured.", error);
    return Response.json(
      { message: "Account services are not configured. Please contact the site administrator." },
      { status: 503 },
    );
  }

  return auth.handler(request);
};

export const { GET, POST, PATCH, PUT, DELETE } = toNextJsHandler(handleAuthRequest);
