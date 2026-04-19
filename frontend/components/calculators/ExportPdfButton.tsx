"use client";

import { useState } from "react";

interface ExportPdfButtonProps {
  fileName: string;
  title: string;
  lines: string[];
}

export default function ExportPdfButton({ fileName, title, lines }: ExportPdfButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    if (loading) {
      return;
    }
    setLoading(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "pt", format: "a4" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text(title, 40, 42);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Genere le: ${new Date().toLocaleString("fr-TN")}`, 40, 60);

      doc.setDrawColor(212, 160, 80);
      doc.line(40, 70, 555, 70);

      doc.setFontSize(11);
      let y = 88;
      const maxWidth = 515;
      const pageBottom = 800;

      for (const line of lines) {
        const wrappedLines = doc.splitTextToSize(line, maxWidth) as string[];
        for (const wrappedLine of wrappedLines) {
          if (y > pageBottom) {
            doc.addPage();
            y = 44;
          }
          doc.text(wrappedLine, 40, y);
          y += 16;
        }
      }

      const normalizedName = fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`;
      doc.save(normalizedName);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => {
        void handleExport();
      }}
      className="inline-flex rounded-lg border border-[rgba(212,160,80,0.33)] bg-[var(--surface-2)] px-3 py-2 text-sm font-semibold text-[var(--text-dark)] transition hover:bg-[var(--surface-3)]"
      disabled={loading}
    >
      {loading ? "Generation PDF..." : "Export PDF"}
    </button>
  );
}
