"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";

const APPLE_BUTTON_HEIGHT = 40;
const APPLE_BUTTON_MIN_WIDTH = 140;
const APPLE_BUTTON_MAX_WIDTH = 375;
const GOOGLE_IDENTITY_SCRIPT_ID = "google-identity-services";
const GOOGLE_IDENTITY_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

type OfficialSocialAuthButtonsProps = {
  googleClientId?: string;
  isLoading: boolean;
  onAppleClick: () => void | Promise<void>;
  onGoogleCredential: (credential: string) => void | Promise<void>;
};

type GoogleCredentialResponse = {
  credential?: string;
};

type GoogleAccountsIdInitializeOptions = {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void;
  auto_select?: boolean;
  cancel_on_tap_outside?: boolean;
  context?: "signin" | "signup" | "use";
  itp_support?: boolean;
};

type GoogleButtonOptions = {
  type?: "standard" | "icon";
  theme?: "outline" | "filled_blue" | "filled_black";
  size?: "large" | "medium" | "small";
  text?: "signin_with" | "signup_with" | "continue_with" | "signin";
  shape?: "rectangular" | "pill" | "circle" | "square";
  logo_alignment?: "left" | "center";
  width?: string;
};

type GoogleAccountsIdApi = {
  initialize: (options: GoogleAccountsIdInitializeOptions) => void;
  renderButton: (element: HTMLElement, options: GoogleButtonOptions) => void;
};

let googleIdentityScriptPromise: Promise<void> | null = null;

function clampButtonWidth(width: number) {
  return Math.max(
    APPLE_BUTTON_MIN_WIDTH,
    Math.min(Math.round(width), APPLE_BUTTON_MAX_WIDTH),
  );
}

function buildAppleButtonSrc(width: number, scale = 1) {
  const params = new URLSearchParams({
    color: "black",
    border: "true",
    type: "sign-in",
    border_radius: "16",
    width: String(width),
    height: String(APPLE_BUTTON_HEIGHT),
    scale: String(scale),
  });

  return `https://appleid.cdn-apple.com/appleid/button?${params.toString()}`;
}

function loadGoogleIdentityScript() {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  if (window.google?.accounts.id) {
    return Promise.resolve();
  }

  if (googleIdentityScriptPromise) {
    return googleIdentityScriptPromise;
  }

  googleIdentityScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById(
      GOOGLE_IDENTITY_SCRIPT_ID,
    ) as HTMLScriptElement | null;

    if (existingScript) {
      if (existingScript.dataset.loaded === "true") {
        resolve();
        return;
      }

      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener(
        "error",
        () => {
          googleIdentityScriptPromise = null;
          reject(new Error("Unable to load Google Sign-In."));
        },
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.id = GOOGLE_IDENTITY_SCRIPT_ID;
    script.src = GOOGLE_IDENTITY_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => {
      googleIdentityScriptPromise = null;
      reject(new Error("Unable to load Google Sign-In."));
    };
    document.head.appendChild(script);
  });

  return googleIdentityScriptPromise;
}

function getGoogleAccountsId() {
  return window.google?.accounts.id as GoogleAccountsIdApi | undefined;
}

function useObservedButtonWidth() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(APPLE_BUTTON_MAX_WIDTH);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    const updateWidth = () => {
      const nextWidth = clampButtonWidth(element.getBoundingClientRect().width);

      setWidth((currentWidth) =>
        currentWidth === nextWidth ? currentWidth : nextWidth,
      );
    };

    updateWidth();

    const observer = new ResizeObserver(() => {
      updateWidth();
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  return { ref, width };
}

function GoogleSignInButton({
  googleClientId,
  isLoading,
  onGoogleCredential,
}: Pick<
  OfficialSocialAuthButtonsProps,
  "googleClientId" | "isLoading" | "onGoogleCredential"
>) {
  const { ref, width } = useObservedButtonWidth();
  const buttonContainerRef = useRef<HTMLDivElement | null>(null);
  const initializedClientIdRef = useRef<string | null>(null);
  const [isScriptReady, setIsScriptReady] = useState(false);
  const [googleLoadError, setGoogleLoadError] = useState<string | null>(null);

  const availabilityMessage =
    !googleClientId
      ? "Google Sign-In is not configured for this environment."
      : googleLoadError;
  const isReady = Boolean(googleClientId) && isScriptReady && !googleLoadError;

  const handleCredential = useEffectEvent(
    async (response: GoogleCredentialResponse) => {
      if (isLoading) {
        return;
      }

      if (!response.credential) {
        setGoogleLoadError("Google Sign-In did not return a credential.");
        return;
      }

      setGoogleLoadError(null);
      await onGoogleCredential(response.credential);
    },
  );

  useEffect(() => {
    if (!googleClientId) {
      return;
    }

    let cancelled = false;

    void loadGoogleIdentityScript()
      .then(() => {
        if (cancelled) {
          return;
        }

        const googleAccounts = getGoogleAccountsId();
        if (!googleAccounts) {
          setGoogleLoadError("Google Sign-In failed to initialize.");
          setIsScriptReady(false);
          return;
        }

        if (initializedClientIdRef.current !== googleClientId) {
          googleAccounts.initialize({
            client_id: googleClientId,
            callback: (response: GoogleCredentialResponse) => {
              void handleCredential(response);
            },
            auto_select: false,
            cancel_on_tap_outside: true,
            context: "signin",
            itp_support: true,
          });
          initializedClientIdRef.current = googleClientId;
        }

        setGoogleLoadError(null);
        setIsScriptReady(true);
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        setGoogleLoadError(
          error instanceof Error ? error.message : "Unable to load Google Sign-In.",
        );
        setIsScriptReady(false);
      });

    return () => {
      cancelled = true;
    };
  }, [googleClientId]);

  useEffect(() => {
    if (!isReady || !buttonContainerRef.current) {
      return;
    }

    const googleAccounts = getGoogleAccountsId();
    if (!googleAccounts) {
      return;
    }

    buttonContainerRef.current.innerHTML = "";
    googleAccounts.renderButton(buttonContainerRef.current, {
      type: "standard",
      theme: "filled_black",
      size: "large",
      text: "signin_with",
      shape: "rectangular",
      logo_alignment: "left",
      width: String(width),
    });
  }, [isReady, width]);

  return (
    <div className={`w-full ${isLoading ? "pointer-events-none opacity-60" : ""}`}>
      <div className="mx-auto w-full max-w-93.75 rounded-2xl focus-within:ring-2 focus-within:ring-amber-300/70 focus-within:ring-offset-2 focus-within:ring-offset-slate-950">
        <div ref={ref} className="overflow-hidden rounded-2xl">
          {availabilityMessage ? (
            <div
              className="flex min-h-10 items-center justify-center rounded-2xl bg-slate-950/45 px-4 text-center text-xs font-medium text-slate-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
              aria-live="polite"
            >
              {availabilityMessage}
            </div>
          ) : (
            <div
              ref={buttonContainerRef}
              className="grid min-h-10 place-items-stretch"
              aria-label="Sign in with Google"
            />
          )}
        </div>
      </div>
    </div>
  );
}

function AppleSignInButton({
  isLoading,
  onAppleClick,
}: Pick<OfficialSocialAuthButtonsProps, "isLoading" | "onAppleClick">) {
  const { ref, width } = useObservedButtonWidth();

  return (
    <div className={`w-full ${isLoading ? "opacity-60" : ""}`}>
      <div ref={ref} className="mx-auto w-full max-w-93.75">
        <button
          type="button"
          onClick={() => {
            void onAppleClick();
          }}
          disabled={isLoading}
          aria-label="Sign in with Apple"
          className="inline-flex w-full overflow-hidden rounded-2xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed"
        >
          {/* Apple requires the hosted button artwork to stay within the documented web size bounds. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={buildAppleButtonSrc(width, 1)}
            srcSet={[
              `${buildAppleButtonSrc(width, 1)} 1x`,
              `${buildAppleButtonSrc(width, 2)} 2x`,
              `${buildAppleButtonSrc(width, 3)} 3x`,
            ].join(", ")}
            alt=""
            aria-hidden="true"
            width={width}
            height={APPLE_BUTTON_HEIGHT}
            className="block h-auto w-full"
          />
        </button>
      </div>
    </div>
  );
}

export function OfficialSocialAuthButtons(
  props: OfficialSocialAuthButtonsProps,
) {
  return (
    <>
      <GoogleSignInButton
        googleClientId={props.googleClientId}
        isLoading={props.isLoading}
        onGoogleCredential={props.onGoogleCredential}
      />
      <AppleSignInButton
        isLoading={props.isLoading}
        onAppleClick={props.onAppleClick}
      />
    </>
  );
}
