"use client";

import { useEffect } from "react";
import { reportAppError } from "@/lib/error-reporting";

export default function ErrorBoundary({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error);
    reportAppError(error, { boundary: "nextjs_root_error_boundary" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-page px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-primary">
          This page didn&apos;t load
        </h1>
        <p className="mt-2 text-sm text-tertiary">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => reset()}
            className="inline-flex items-center justify-center rounded-md bg-action-primary px-4 py-2 text-sm font-medium text-on-color transition-colors hover:bg-action-primary-hover"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-muted bg-page px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-action"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}
