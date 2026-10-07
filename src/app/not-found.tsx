import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-page px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-primary">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-primary">Page not found</h2>
        <p className="mt-2 text-sm text-tertiary">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-md bg-action-primary px-4 py-2 text-sm font-medium text-on-color transition-colors hover:bg-action-primary-hover"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
