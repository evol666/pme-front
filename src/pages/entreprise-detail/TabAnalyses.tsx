import { Plus, RefreshCw } from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router";
import { useAnalyses, useLaunchAnalysis } from "@/api/analyses";
import {
	useContextualDiagnostic,
	useRecommandationsForJobs,
} from "@/api/recommandations";
import { cn } from "@/lib/utils";
import { ConsultantDiagnosticSection } from "./ConsultantDiagnosticSection";

// Onglet Analyses : diagnostic consultant contextuel puis historique des
// analyses lancées sur le SIREN.

export function TabAnalyses({
	siren,
	onLaunchModule,
}: {
	readonly siren: string;
	readonly onLaunchModule: (item: any) => void;
}) {
	const navigate = useNavigate();
	const { data: analyses, refetch, isFetching } = useAnalyses(siren);
	const launch = useLaunchAnalysis();
	const diagnostic = useContextualDiagnostic();
	const lastAnalysis = (analyses ?? [])[0];

	// Chargeons les recommandations associées aux jobs de cette entreprise pour persistance
	const jobIds = useMemo(() => (analyses ?? []).map((a) => a.job_id).filter(Boolean), [analyses]);
	const { data: recos, refetch: refetchRecos, isFetching: isFetchingRecos } = useRecommandationsForJobs(jobIds);

	const savedDiagnosticData = useMemo(() => {
		const savedConsultantReco = recos?.find((r) => r.category === "consultant");
		if (savedConsultantReco?.payload) {
			try {
				const parsed = JSON.parse(savedConsultantReco.payload);
				return {
					siren,
					metierId: savedConsultantReco.metierId ?? lastAnalysis?.detected_business_id ?? "generique",
					diagnostic: parsed,
					actionPrioritaire: savedConsultantReco,
				};
			} catch (e) {
				console.warn("Failed to parse saved diagnostic payload", e);
			}
		}
		return undefined;
	}, [recos, siren, lastAnalysis]);

	const displayData = diagnostic.data || savedDiagnosticData;

	async function handleLaunch() {
		const ack = await launch.mutateAsync({ siren });
		navigate(`/analyse?jobId=${ack.job_id}`);
	}

	async function handleGenerateDiagnostic() {
		await diagnostic.mutateAsync({
			siren,
			jobId: lastAnalysis?.job_id,
			metierId: lastAnalysis?.detected_business_id ?? undefined,
		});
	}

	return (
		<div className="space-y-4">
			{/* Diagnostic consultant contextuel (Lot C) — orienté métier détecté. */}
			<ConsultantDiagnosticSection
				isPending={diagnostic.isPending}
				isError={diagnostic.isError}
				error={diagnostic.error}
				data={displayData}
				onGenerate={handleGenerateDiagnostic}
				onLaunchModule={onLaunchModule}
				onRefresh={() => {
					refetch();
					if (jobIds.length > 0) {
						refetchRecos();
					}
				}}
				isRefreshing={isFetching || isFetchingRecos}
			/>

			<div className="flex items-center justify-between pt-4 border-t border-border/40">
				<h2 className="text-sm font-bold text-foreground">Historique des analyses</h2>
				<div className="flex gap-2">
					<button type="button"
						onClick={() => refetch()}
						disabled={isFetching}
						className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
					>
						<RefreshCw
							className={cn("w-4 h-4", isFetching && "animate-spin")}
						/>
					</button>
					<button type="button"
						onClick={handleLaunch}
						disabled={launch.isPending}
						className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
					>
						<Plus className="w-4 h-4" />
						Nouvelle analyse
					</button>
				</div>
			</div>
		</div>
	);
}
