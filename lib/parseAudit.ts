/**
 * Parses a UMD CS degree audit HTML file (uAchieve Self-Service export)
 * into a structured JSON object.
 *
 * Usage (browser):
 *   const html = await file.text();
 *   const audit = parseAudit(html);
 */

export interface AuditResult {
  student: {
    name: string | null;
    program: string | null;
    catalog_year: string | null;
    prepared_on: string | null;
  };
  credits: {
    earned: number | null;
    in_progress: number | null;
    still_needed: number | null;
    total_required: number;
  };
  upper_level_concentration: {
    credits_needed: number | null;
    note: string;
  };
  upper_level_requirements: {
    description: string;
    areas: Record<string, { select_from: string[] }>;
  };
  cmsc_electives: {
    description: string;
    credits_needed: number | null;
    excluded: string[];
    courses_in_progress: string[];
  };
  general_education: {
    total_required_credits: number;
    fundamental_studies: Record<string, string[]>;
    distributive_studies: Record<string, string[]>;
    big_question: { description: string; courses: string[] };
    diversity: Record<string, string[]>;
  };
}

export function parseAudit(html: string): AuditResult {
  const doc = new DOMParser().parseFromString(html, 'text/html');

  const rawText = doc.body.innerText ?? doc.body.textContent ?? '';
  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  function findLine(pred: (l: string) => boolean, from = 0, to = lines.length): number {
    for (let i = from; i < to; i++) if (pred(lines[i])) return i;
    return -1;
  }

  function nextNumber(i: number, window = 6): number | null {
    for (let j = i + 1; j < Math.min(i + window, lines.length); j++) {
      const m = lines[j].match(/^(\d+\.?\d*)$/);
      if (m) return parseFloat(m[1]);
    }
    return null;
  }

  // 1. Student info
  const student: AuditResult['student'] = {
    name: null,
    program: null,
    catalog_year: null,
    prepared_on: null,
  };

  const csIdx = findLine((l) => l === 'Computer Science');
  if (csIdx > 0) student.name = lines[csIdx - 1];
  student.program = csIdx >= 0 ? lines[csIdx] : null;

  const prepIdx = findLine((l) => l === 'Prepared On');
  if (prepIdx >= 0) student.prepared_on = lines[prepIdx + 1] ?? null;

  const catIdx = findLine((l) => l === 'Catalog Year');
  if (catIdx >= 0) student.catalog_year = lines[catIdx + 1] ?? null;

  // 2. Credits
  const credits: AuditResult['credits'] = {
    earned: null,
    in_progress: null,
    still_needed: null,
    total_required: 120,
  };

  const totIdx = findLine((l) => l.includes('Total UG Cumulative Credits (minimum 120)'));
  if (totIdx >= 0) {
    credits.earned = nextNumber(totIdx);
    const inpIdx = findLine((l) => l.includes('IN-P'), totIdx, totIdx + 8);
    if (inpIdx >= 0) credits.in_progress = nextNumber(inpIdx);
    if (credits.earned !== null && credits.in_progress !== null) {
      credits.still_needed = Math.max(0, credits.total_required - credits.earned - credits.in_progress);
    }
  }

  // 3. Upper Level Concentration
  const ulcIdx = findLine((l) => l === 'Upper Level Concentration', 0, 250);
  const ulc: AuditResult['upper_level_concentration'] = {
    credits_needed: null,
    note: 'Does not auto-populate. Contact CS advisor to manually enter eligible courses.',
  };
  if (ulcIdx >= 0) {
    const needsIdx = findLine((l) => l === 'NEEDS:', ulcIdx, ulcIdx + 20);
    if (needsIdx >= 0) ulc.credits_needed = nextNumber(needsIdx);
  }

  // 4. Upper Level Requirements
  const upperLevelReq: AuditResult['upper_level_requirements'] = {
    description: 'Complete 5 courses at 400 level from at least 3 areas, no more than 3 per area',
    areas: {},
  };

  const ulrStart = findLine((l) => l === 'Upper Level Requirements');
  const ulrEnd = findLine((l) => l === 'CMSC Electives', ulrStart);

  if (ulrStart >= 0 && ulrEnd >= 0) {
    let currentArea: string | null = null;
    let collecting = false;

    for (let i = ulrStart + 1; i < ulrEnd; i++) {
      const l = lines[i];

      if (/^\d+\)$/.test(l) && i + 1 < ulrEnd) {
        currentArea = lines[i + 1];
        upperLevelReq.areas[currentArea] = { select_from: [] };
        collecting = false;
        continue;
      }

      if (l === 'SELECT FROM:' && currentArea) { collecting = true; continue; }

      if (collecting && currentArea) {
        const area = upperLevelReq.areas[currentArea];

        if (/^(CMSC|MATH|AMSC) \d+$/.test(l)) {
          area.select_from.push(l);
        } else if (/^\d+$/.test(l) && area.select_from.length) {
          const prefix = area.select_from.at(-1)!.split(' ')[0];
          area.select_from.push(`${prefix} ${l}`);
        } else if (l === ',' || l === 'OR') {
          // separators — skip
        } else if (/^Sub-Requirement|^SELECT FROM/.test(l)) {
          collecting = false;
        }
      }
    }
  }

  // 5. CMSC Electives
  const elecStart = findLine((l) => l === 'CMSC Electives');
  const elecEnd = findLine((l) => l.includes('General Education'), elecStart);

  const cmscElectives: AuditResult['cmsc_electives'] = {
    description: '',
    credits_needed: null,
    excluded: [],
    courses_in_progress: [],
  };

  if (elecStart >= 0 && elecEnd >= 0) {
    for (let i = elecStart + 1; i < elecEnd; i++) {
      const l = lines[i];

      if (l.includes('Credits at the CMSC')) cmscElectives.description = l;

      if (l.includes('Not eligible:')) {
        cmscElectives.excluded = [...l.matchAll(/CMSC\s*\d+/g)].map((m) => m[0].replace(/\s+/, ''));
      }

      if (l === 'NEEDS:') {
        cmscElectives.credits_needed = nextNumber(i);
      }

      if (/^(Sp|Fa)\d{2}$/.test(l) && i + 1 < elecEnd && /^CMSC\d+$/.test(lines[i + 1])) {
        const course = lines[i + 1];
        for (let k = i + 2; k < Math.min(i + 5, elecEnd); k++) {
          if (lines[k] === 'IP') { cmscElectives.courses_in_progress.push(course); break; }
        }
      }
    }
  }

  // 6. General Education
  function parseSubReqs(startMarker: string, endMarker: string): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    const start = findLine((l) => l === startMarker);
    const end = findLine((l) => l === endMarker, start);
    if (start < 0 || end < 0) return result;

    let currentSub: string | null = null;
    for (let i = start + 1; i < end; i++) {
      const l = lines[i];
      if (/^\d+\)$/.test(l) && i + 1 < end) {
        currentSub = lines[i + 1];
        result[currentSub] = [];
        continue;
      }
      if (currentSub && /^(Sp|Fa)\d{2}$/.test(l) && i + 1 < end) {
        result[currentSub].push(lines[i + 1]);
      }
    }
    return result;
  }

  const genEd: AuditResult['general_education'] = {
    total_required_credits: 40,
    fundamental_studies: parseSubReqs('[GenEd] Fundamental Studies', '[GenEd] Distributive Studies'),
    distributive_studies: parseSubReqs('[GenEd] Distributive Studies', '[GenEd] The Big Question'),
    big_question: { description: 'I-Series (SCIS)', courses: [] },
    diversity: parseSubReqs('[GenEd] Diversity', 'General Elective Courses'),
  };

  const bqStart = findLine((l) => l === '[GenEd] The Big Question');
  const bqEnd = findLine((l) => l === '[GenEd] Diversity', bqStart);
  if (bqStart >= 0 && bqEnd >= 0) {
    for (let i = bqStart + 1; i < bqEnd; i++) {
      if (/^(Sp|Fa)\d{2}$/.test(lines[i]) && i + 1 < bqEnd) {
        genEd.big_question.courses.push(lines[i + 1]);
      }
    }
  }

  return {
    student,
    credits,
    upper_level_concentration: ulc,
    upper_level_requirements: upperLevelReq,
    cmsc_electives: cmscElectives,
    general_education: genEd,
  };
}
