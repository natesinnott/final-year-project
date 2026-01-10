import { getAuthWithSsoProviders } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export async function GET(request: Request) {
  const auth = await getAuthWithSsoProviders();
  const handler = toNextJsHandler(auth);
  return handler.GET(request);
}

export async function POST(request: Request) {
  const auth = await getAuthWithSsoProviders();
  const handler = toNextJsHandler(auth);
  return handler.POST(request);
}
