import type {
  Heir,
  HeirResult,
  HeirType,
  InheritanceInput,
  InheritanceResult,
} from "./types";

type ShareRow = {
  heir: Heir;
  share: number;
  shareType: "fard" | "asaba";
  articleRef: string;
};

const ARTICLE_REF: Record<HeirType, string> = {
  husband: "CSP Art. 143",
  wife: "CSP Art. 143",
  son: "CSP Art. 119",
  daughter: "CSP Art. 118/119",
  father: "CSP Art. 130",
  mother: "CSP Art. 131",
  paternal_grandfather: "CSP Art. 136",
  paternal_grandmother: "CSP Art. 137",
  maternal_grandmother: "CSP Art. 137",
  full_brother: "CSP Art. 136",
  full_sister: "CSP Art. 136",
  paternal_half_brother: "CSP Art. 136",
  paternal_half_sister: "CSP Art. 136",
  maternal_half_brother: "CSP Art. 131/136",
  maternal_half_sister: "CSP Art. 131/136",
  sons_son: "CSP Art. 119",
  sons_daughter: "CSP Art. 118/119",
};

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

function decimalToFraction(value: number): { numerator: number; denominator: number } {
  const denominator = 12000;
  const numerator = Math.round(value * denominator);
  const divisor = gcd(numerator, denominator);
  return {
    numerator: numerator / divisor,
    denominator: denominator / divisor,
  };
}

function mapHeirs(input: InheritanceInput): Map<HeirType, Heir> {
  const map = new Map<HeirType, Heir>();
  for (const heir of input.heirs) {
    if (heir.count > 0) {
      map.set(heir.type, heir);
    }
  }
  return map;
}

function count(map: Map<HeirType, Heir>, type: HeirType): number {
  return map.get(type)?.count ?? 0;
}

function hasAny(map: Map<HeirType, Heir>, list: HeirType[]): boolean {
  return list.some((item) => count(map, item) > 0);
}

export function calculateInheritance(input: InheritanceInput): InheritanceResult {
  const heirMap = mapHeirs(input);
  const hajbNotes: string[] = [];

  const blockedBy = new Map<HeirType, HeirType>();
  const block = (blocked: HeirType, blocker: HeirType, note: string) => {
    if (count(heirMap, blocked) > 0 && !blockedBy.has(blocked)) {
      blockedBy.set(blocked, blocker);
      hajbNotes.push(note);
    }
  };

  const hasDescendants = hasAny(heirMap, ["son", "daughter", "sons_son", "sons_daughter"]);
  const hasSons = count(heirMap, "son") > 0;
  const daughterCount = count(heirMap, "daughter");
  const sonsSonCount = count(heirMap, "sons_son");
  const sonsDaughterCount = count(heirMap, "sons_daughter");
  const paternalHalfBrotherCount = count(heirMap, "paternal_half_brother");
  const paternalHalfSisterCount = count(heirMap, "paternal_half_sister");

  if (count(heirMap, "father") > 0) {
    block("paternal_grandfather", "father", "Hajb: Father blocks paternal grandfather (Art. 136)");
    block("full_brother", "father", "Hajb: Father blocks siblings (Art. 136)");
    block("full_sister", "father", "Hajb: Father blocks siblings (Art. 136)");
    block("paternal_half_brother", "father", "Hajb: Father blocks paternal half siblings (Art. 136)");
    block("paternal_half_sister", "father", "Hajb: Father blocks paternal half siblings (Art. 136)");
    block("maternal_half_brother", "father", "Hajb: Father blocks uterine siblings (Art. 136)");
    block("maternal_half_sister", "father", "Hajb: Father blocks uterine siblings (Art. 136)");
  }

  if (hasSons) {
    block("sons_son", "son", "Hajb: Son blocks son's son (Art. 119)");
    block("sons_daughter", "son", "Hajb: Son blocks son's daughter (Art. 119)");
    block("full_brother", "son", "Hajb: Children block siblings");
    block("full_sister", "son", "Hajb: Children block siblings");
    block("paternal_half_brother", "son", "Hajb: Children block paternal half siblings");
    block("paternal_half_sister", "son", "Hajb: Children block paternal half siblings");
  }

  if (hasDescendants) {
    block("maternal_half_brother", "son", "Hajb: Children block uterine siblings");
    block("maternal_half_sister", "son", "Hajb: Children block uterine siblings");
  }

  if (count(heirMap, "full_brother") > 0) {
    block("paternal_half_brother", "full_brother", "Hajb: Full brother blocks paternal half brother");
    block("paternal_half_sister", "full_brother", "Hajb: Full brother blocks paternal half sister");
  }

  if (daughterCount >= 2 && sonsSonCount === 0) {
    block("sons_daughter", "daughter", "Hajb: Two daughters block son's daughter unless a son's son exists");
  }

  const shares: ShareRow[] = [];
  const addFixed = (type: HeirType, ratio: number) => {
    const heir = heirMap.get(type);
    if (!heir || blockedBy.has(type)) {
      return;
    }
    shares.push({
      heir,
      share: ratio,
      shareType: "fard",
      articleRef: ARTICLE_REF[type],
    });
  };

  const siblingCount =
    count(heirMap, "full_brother") +
    count(heirMap, "full_sister") +
    count(heirMap, "paternal_half_brother") +
    count(heirMap, "paternal_half_sister") +
    count(heirMap, "maternal_half_brother") +
    count(heirMap, "maternal_half_sister");

  if (count(heirMap, "husband") > 0) {
    addFixed("husband", hasDescendants ? 1 / 4 : 1 / 2);
  }

  const wifeCount = count(heirMap, "wife");
  if (wifeCount > 0 && !blockedBy.has("wife")) {
    shares.push({
      heir: heirMap.get("wife") as Heir,
      share: hasDescendants ? 1 / 8 : 1 / 4,
      shareType: "fard",
      articleRef: ARTICLE_REF.wife,
    });
  }

  if (count(heirMap, "mother") > 0 && !blockedBy.has("mother")) {
    addFixed("mother", hasDescendants || siblingCount >= 2 ? 1 / 6 : 1 / 3);
  }

  const fatherPresent = count(heirMap, "father") > 0 && !blockedBy.has("father");
  if (fatherPresent && hasSons) {
    addFixed("father", 1 / 6);
  }

  const sonCount = count(heirMap, "son");
  if (daughterCount > 0 && sonCount === 0 && !blockedBy.has("daughter")) {
    shares.push({
      heir: heirMap.get("daughter") as Heir,
      share: daughterCount === 1 ? 1 / 2 : 2 / 3,
      shareType: "fard",
      articleRef: ARTICLE_REF.daughter,
    });
  }

  if (
    sonsSonCount === 0 &&
    sonsDaughterCount > 0 &&
    sonCount === 0 &&
    !blockedBy.has("sons_daughter")
  ) {
    shares.push({
      heir: heirMap.get("sons_daughter") as Heir,
      share: sonsDaughterCount === 1 ? 1 / 2 : 2 / 3,
      shareType: "fard",
      articleRef: ARTICLE_REF.sons_daughter,
    });
  }

  const uterineBrotherCount = count(heirMap, "maternal_half_brother");
  const uterineSisterCount = count(heirMap, "maternal_half_sister");
  const uterineTotal = uterineBrotherCount + uterineSisterCount;
  if (
    uterineTotal > 0 &&
    !hasDescendants &&
    !fatherPresent &&
    !blockedBy.has("maternal_half_brother") &&
    !blockedBy.has("maternal_half_sister")
  ) {
    const totalShare = uterineTotal === 1 ? 1 / 6 : 1 / 3;

    if (uterineBrotherCount > 0) {
      shares.push({
        heir: heirMap.get("maternal_half_brother") as Heir,
        share: totalShare * (uterineBrotherCount / uterineTotal),
        shareType: "fard",
        articleRef: ARTICLE_REF.maternal_half_brother,
      });
    }
    if (uterineSisterCount > 0) {
      shares.push({
        heir: heirMap.get("maternal_half_sister") as Heir,
        share: totalShare * (uterineSisterCount / uterineTotal),
        shareType: "fard",
        articleRef: ARTICLE_REF.maternal_half_sister,
      });
    }
  }

  const fixedSumRaw = shares.reduce((acc, row) => acc + row.share, 0);
  let awlApplied = false;
  let raddApplied = false;

  if (fixedSumRaw > 1) {
    awlApplied = true;
    for (const row of shares) {
      row.share = row.share / fixedSumRaw;
    }
  }

  const fixedSum = shares.reduce((acc, row) => acc + row.share, 0);
  let remainder = Math.max(0, 1 - fixedSum);

  const asabaRows: ShareRow[] = [];

  if (remainder > 0) {
    if (sonCount > 0) {
      const totalUnits = sonCount * 2 + daughterCount;
      if (sonCount > 0) {
        asabaRows.push({
          heir: heirMap.get("son") as Heir,
          share: remainder * ((sonCount * 2) / totalUnits),
          shareType: "asaba",
          articleRef: ARTICLE_REF.son,
        });
      }
      if (daughterCount > 0) {
        asabaRows.push({
          heir: heirMap.get("daughter") as Heir,
          share: remainder * (daughterCount / totalUnits),
          shareType: "asaba",
          articleRef: ARTICLE_REF.daughter,
        });
      }
      remainder = 0;
    } else if (fatherPresent) {
      asabaRows.push({
        heir: heirMap.get("father") as Heir,
        share: remainder,
        shareType: "asaba",
        articleRef: ARTICLE_REF.father,
      });
      remainder = 0;
    } else {
      const fullBrotherCount = count(heirMap, "full_brother");
      const fullSisterCount = count(heirMap, "full_sister");
      if (fullBrotherCount > 0 || fullSisterCount > 0) {
        const totalUnits = fullBrotherCount * 2 + fullSisterCount;
        if (fullBrotherCount > 0 && !blockedBy.has("full_brother")) {
          asabaRows.push({
            heir: heirMap.get("full_brother") as Heir,
            share: remainder * ((fullBrotherCount * 2) / totalUnits),
            shareType: "asaba",
            articleRef: ARTICLE_REF.full_brother,
          });
        }
        if (fullSisterCount > 0 && !blockedBy.has("full_sister")) {
          asabaRows.push({
            heir: heirMap.get("full_sister") as Heir,
            share: remainder * (fullSisterCount / totalUnits),
            shareType: "asaba",
            articleRef: ARTICLE_REF.full_sister,
          });
        }
        remainder = 0;
      } else if (paternalHalfBrotherCount > 0 || paternalHalfSisterCount > 0) {
        const totalUnits = paternalHalfBrotherCount * 2 + paternalHalfSisterCount;
        if (paternalHalfBrotherCount > 0 && !blockedBy.has("paternal_half_brother")) {
          asabaRows.push({
            heir: heirMap.get("paternal_half_brother") as Heir,
            share: remainder * ((paternalHalfBrotherCount * 2) / totalUnits),
            shareType: "asaba",
            articleRef: ARTICLE_REF.paternal_half_brother,
          });
        }
        if (paternalHalfSisterCount > 0 && !blockedBy.has("paternal_half_sister")) {
          asabaRows.push({
            heir: heirMap.get("paternal_half_sister") as Heir,
            share: remainder * (paternalHalfSisterCount / totalUnits),
            shareType: "asaba",
            articleRef: ARTICLE_REF.paternal_half_sister,
          });
        }
        remainder = 0;
      }
    }
  }

  if (remainder > 0 && asabaRows.length === 0 && shares.length > 0) {
    const raddEligible = shares.filter((row) => row.heir.type !== "husband" && row.heir.type !== "wife");
    const eligibleSum = raddEligible.reduce((acc, row) => acc + row.share, 0);
    if (eligibleSum > 0) {
      raddApplied = true;
      for (const row of raddEligible) {
        const ratio = row.share / eligibleSum;
        row.share += remainder * ratio;
      }
      remainder = 0;
    }
  }

  const allRows = [...shares, ...asabaRows];

  const heirResults: HeirResult[] = [];
  for (const row of allRows) {
    const perHeirShare = row.share / row.heir.count;
    const fraction = decimalToFraction(perHeirShare);
    const amountTND = input.estateValue ? perHeirShare * input.estateValue : undefined;
    heirResults.push({
      heir: row.heir,
      shareNumerator: fraction.numerator,
      shareDenominator: fraction.denominator,
      shareType: row.shareType,
      articleRef: row.articleRef,
      amountTND,
    });
  }

  for (const heir of input.heirs) {
    if (heir.count <= 0) {
      continue;
    }
    const blocker = blockedBy.get(heir.type);
    if (!blocker) {
      continue;
    }
    heirResults.push({
      heir,
      shareNumerator: 0,
      shareDenominator: 1,
      shareType: "blocked",
      articleRef: ARTICLE_REF[heir.type],
      blockedBy: blocker,
      amountTND: 0,
    });
  }

  const total = heirResults
    .filter((row) => row.shareType !== "blocked")
    .reduce((acc, row) => acc + row.shareNumerator / row.shareDenominator, 0);
  const totalFraction = decimalToFraction(total);

  return {
    heirs: heirResults,
    awlApplied,
    raddApplied,
    hajbNotes,
    totalVerification: `${totalFraction.numerator}/${totalFraction.denominator}`,
  };
}
