"use client";
import { PageLoadError } from "@/components/page-load-error";

// Also catch failed access reads in the portal layout, outside its own boundary.
export default function ErrorPage({ retry }: { retry: () => void }) {
  return (
    <main className="mx-auto max-w-2xl p-6 py-20">
      <PageLoadError retry={retry} />
    </main>
  );
}
