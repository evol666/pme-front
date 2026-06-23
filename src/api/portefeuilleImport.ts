import axiosClient from "@/api/axiosClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { portefeuilleKeys } from "@/api/portefeuille";

export interface ImportError {
  line: number;
  raw: string;
  message: string;
}

export interface ImportReport {
  imported: number;
  skipped: number;
  importedSirens: string[];
  skippedSirens: string[];
  errors: ImportError[];
}

/** Upload d'un CSV et import batch dans le portefeuille. */
export function useImportCsv() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const { data } = await axiosClient.post<ImportReport>(
        "/api/portefeuille/import-csv",
        form,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: portefeuilleKeys.all }),
  });
}

/** Télécharge le template CSV vierge. */
export async function downloadTemplate() {
  const { data } = await axiosClient.get<string>("/api/portefeuille/template", {
    responseType: "text",
  });
  const blob = new Blob([data], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "template_portefeuille.csv";
  a.click();
  URL.revokeObjectURL(url);
}

/** Déclenche l'import Sirene complet (ADMIN). */
export async function startSireneImport(): Promise<{ status: string; message: string }> {
  const { data } = await axiosClient.post("/api/sirene/import");
  return data;
}

/** Progression de l'import Sirene (ADMIN). */
export async function getSireneImportStatus(): Promise<{
  running: boolean;
  phase: string;
  processed: number;
  upserted: number;
  skipped: number;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}> {
  const { data } = await axiosClient.get("/api/sirene/import/status");
  return data;
}

/** Stats base Sirene locale. */
export async function getSireneStats(): Promise<{
  actives: number;
  cessees: number;
  total: number;
}> {
  const { data } = await axiosClient.get("/api/sirene/stats");
  return data;
}
