import { createAuthClient } from "better-auth/react";
import { genericOAuthClient } from "better-auth/client/plugins";

// Client-side auth instance with generic OAuth support for dynamic providers.
export const authClient = createAuthClient({
  plugins: [genericOAuthClient()],
});
