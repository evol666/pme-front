// Conversion des codes INSEE « tranche d'effectif salarié » (trancheEffectifsUniteLegale)
// en libellé lisible (plage de salariés).
// Référence : https://www.sirene.fr/ (variable Tranche d'effectifs)

const TRANCHE_EFFECTIF: Record<string, string> = {
  NN: "Effectif non renseigné",
  "00": "0 salarié",
  "01": "1 ou 2 salariés",
  "02": "3 à 5 salariés",
  "03": "6 à 9 salariés",
  "11": "10 à 19 salariés",
  "12": "20 à 49 salariés",
  "21": "50 à 99 salariés",
  "22": "100 à 199 salariés",
  "31": "200 à 249 salariés",
  "32": "250 à 499 salariés",
  "41": "500 à 999 salariés",
  "42": "1 000 à 1 999 salariés",
  "51": "2 000 à 4 999 salariés",
  "52": "5 000 à 9 999 salariés",
  "53": "10 000 salariés et plus",
};

/**
 * Convertit un code de tranche d'effectif INSEE en plage lisible.
 * Ex. "12" → "20 à 49 salariés". Tolère les valeurs non padées ("1" → "01").
 * Retourne `null` si la valeur est vide, ou le code brut s'il est inconnu.
 */
export function libelleTrancheEffectif(code: string | null | undefined): string | null {
  if (code == null) return null;
  const raw = String(code).trim();
  if (raw === "") return null;
  const key = raw.length === 1 ? `0${raw}` : raw;
  return TRANCHE_EFFECTIF[key] ?? TRANCHE_EFFECTIF[raw] ?? `Tranche ${raw}`;
}
