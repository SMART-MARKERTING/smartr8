import React from "react";
import type { WorksheetInputs, ScenarioResults } from "./worksheetCalc";

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function headshotAbsoluteUrl(): string {
  return `${window.location.origin}/mykoal-headshot.jpg`;
}

async function buildBlob(
  inputs: WorksheetInputs,
  results: ScenarioResults,
): Promise<Blob> {
  const [{ pdf }, { WorksheetPDF }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("../components/worksheet/WorksheetPDF"),
  ]);

  // Only pass the default headshot URL as a fallback when the user hasn't
  // uploaded one in this session. Otherwise the inline data URL on `inputs`
  // wins (preserving the headshot upload feature).
  const fallbackHeadshot = inputs.headshotDataUrl ? undefined : headshotAbsoluteUrl();

  return pdf(
    <WorksheetPDF
      inputs={inputs}
      results={results}
      headshotUrl={fallbackHeadshot}
    />,
  ).toBlob();
}

/**
 * Warm the lazy PDF chunks (≈490 KB @react-pdf/renderer + the WorksheetPDF
 * component) ahead of time. Call this when the user is about to need a PDF —
 * e.g. on reaching the funnel's contact step — so the eventual generate call
 * doesn't pay for a cold download. Safe to call repeatedly: dynamic import()
 * is cached, and failures are swallowed (buildBlob retries on demand).
 */
export function prefetchWorksheetPdf(): void {
  void import("@react-pdf/renderer").catch(() => {});
  void import("../components/worksheet/WorksheetPDF").catch(() => {});
}

export async function downloadWorksheetPdf(
  inputs: WorksheetInputs,
  results: ScenarioResults,
  fileName: string,
): Promise<void> {
  const blob = await buildBlob(inputs, results);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function getWorksheetPdfBase64(
  inputs: WorksheetInputs,
  results: ScenarioResults,
): Promise<string> {
  const blob = await buildBlob(inputs, results);
  return blobToBase64(blob);
}
