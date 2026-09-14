"use client";
import { PageLoadError } from "@/components/page-load-error";

export default function ErrorPage({ retry }: { retry: () => void }) {
  return <PageLoadError retry={retry} />;
}
