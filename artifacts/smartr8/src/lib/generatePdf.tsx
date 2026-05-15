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

  return pdf(
    <WorksheetPDF
      inputs={inputs}
      results={results}
      headshotUrl={headshotAbsoluteUrl()}
    />,
  ).toBlob();
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
