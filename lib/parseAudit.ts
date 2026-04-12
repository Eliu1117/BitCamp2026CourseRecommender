// ─── Types ───────────────────────────────────────────────────────────────────

export type Status = 'complete' | 'unfulfilled' | 'in_progress' | 'unknown';

export interface CourseEntry {
  semester: string;
  course_id: string;
  credits: number;
  grade: string;
  in_progress: boolean;
  title: string;
}

export interface GenEdSubreq {
  code: string;        
  name: string;        
  status: Status;
  courses_taken: string[]; 
  needs: string | null;
}

export interface GenEdSection {
  status: Status;
  subrequirements: GenEdSubreq[];
}

export interface SubrequirementBlock {
  title: string;
  status: Status;
  pseudo: string;
  courses_taken: CourseEntry[];
  select_from: string[]; 
  needs: string | null;
}

export interface RequirementBlock {
  title: string;
  status: Status;
  pseudo: string;
  category: string;
  credits_taken: number | null;     
  credits_in_progress: number | null; 
  credits_needed: number | null;
  subrequirements: SubrequirementBlock[];
}

export interface LowerLevelSubreq {
  number: string;
  title: string;
  status: Status;
  courses_taken: string[];
  needs: string | null;
  select_from: string[];
}

export interface UpperLevelArea {
  name: string;
  status: Status;
  courses_taken: string[];
  courses_in_progress: string[];
  select_from: string[];
}

export interface AuditResult {
  student: {
    name: string | null;
    program: string | null;
    catalog_year: string | null;
    prepared_on: string | null;
    student_id: string | null;
    gpa: { cumulative: number | null; major: number | null };
  };
  credits: {
    completed: number | null;
    in_progress: number | null;
    needed: number | null;
    total_required: number;
  };
  courses: {
    completed: CourseEntry[];
    in_progress: CourseEntry[];
    all: CourseEntry[];
    completed_ids: string[];
    in_progress_ids: string[];
  };
  upper_level_concentration: {
    status: Status;
    credits_needed: number | null;
    note: string;
  };
  lower_level_requirements: {
    status: Status;
    subrequirements: LowerLevelSubreq[];
  };
  upper_level_requirements: {
    status: Status;
    description: string;
    areas_fulfilled: number;
    three_areas_met: boolean;
    areas: UpperLevelArea[];
  };
  cmsc_electives: {
    status: Status;
    description: string;
    credits_needed: number | null;
    excluded: string[];
    courses_taken: string[];
    courses_in_progress: string[];
  };
  gen_ed: {
    status: Status;
    credits_completed: number | null;
    credits_in_progress: number | null;
    total_required: number;
    fundamental_studies: GenEdSection;
    distributive_studies: GenEdSection;
    big_question: { status: Status; courses_taken: string[] };
    diversity: GenEdSection;
    unfulfilled: string[]; 
  };
  requirements: RequirementBlock[];
  summary: {
    unfulfilled_requirements: string[];
    missing_gen_eds: string[];
    credits_still_needed: number | null;
  };
}



export function parseAudit(html: string): AuditResult {
  const doc = new DOMParser().parseFromString(html, 'text/html');


  const txt = (el: Element | null | undefined): string =>
    el?.textContent?.trim() ?? '';

  function getStatus(el: Element): Status {
    const c = el.className;
    if (c.includes('Status_OK') || c.includes('statusOK')) return 'complete';
    if (c.includes('Status_NO') || c.includes('statusNO')) return 'unfulfilled';
    if (c.includes('Status_IP') || c.includes('statusIP')) return 'in_progress';
    if (c.includes('Status_PL') || c.includes('statusPL')) return 'in_progress';
    return 'unknown';
  }

  function getReqStatus(reqDiv: Element): Status {
    return getStatus(reqDiv);
  }

  function getSubStatus(subDiv: Element): Status {
    const statusEl = subDiv.querySelector('.status');
    return statusEl ? getStatus(statusEl) : 'unknown';
  }

  function extractCourses(container: Element): CourseEntry[] {
    return Array.from(container.querySelectorAll('tr.takenCourse')).map(row => {
      const grade = txt(row.querySelector('.grade'));
      const ccode = txt(row.querySelector('.ccode'));
      return {
        semester: txt(row.querySelector('.term')),
        course_id: txt(row.querySelector('.course')),
        credits: parseFloat(txt(row.querySelector('.credit'))) || 0,
        grade: grade || ccode,
        in_progress: row.classList.contains('ip'),
        title: txt(row.querySelector('.description .descLine')),
      };
    });
  }

  function extractSelectFrom(container: Element): string[] {
    return Array.from(container.querySelectorAll('.selectcourses .course[department][number]'))
      .map(el => {
        const dept = el.getAttribute('department') ?? '';
        const num = el.getAttribute('number') ?? '';
        return `${dept} ${num}`.trim();
      });
  }

  function extractNeeds(container: Element): string | null {
    const el = container.querySelector('.subreqNeeds');
    if (!el) return null;
    const hours = txt(el.querySelector('.hours')).trim();
    const hlabel = txt(el.querySelector('.hourslabel, .smallfieldlabel')).trim();
    const count = txt(el.querySelector('.count')).trim();
    const clabel = txt(el.querySelector('.countlabel, .fieldlabel')).trim();
    if (hours) return `${hours} ${hlabel}`;
    if (count) return `${count} ${clabel}`;
    return null;
  }

  function extractGenEdCode(title: string): string {
    const m = title.match(/\(([A-Z]{4})\)/);
    return m ? m[1] : '';
  }


  const lines = (doc.body.textContent ?? '')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  function findLine(pred: (l: string) => boolean, from = 0): number {
    for (let i = Math.max(0, from); i < lines.length; i++)
      if (pred(lines[i])) return i;
    return -1;
  }

  const student: AuditResult['student'] = {
    name: null, program: null, catalog_year: null,
    prepared_on: null, student_id: null,
    gpa: { cumulative: null, major: null },
  };

  // Name appears on its own line before "Computer Science"
  const progIdx = findLine(l => l.includes('Computer Science'));
  if (progIdx > 0) student.name = lines[progIdx - 1];
  if (progIdx >= 0) student.program = lines[progIdx];

  const prepIdx = findLine(l => l === 'Prepared On');
  if (prepIdx >= 0) student.prepared_on = lines[prepIdx + 1] ?? null;

  const catIdx = findLine(l => l === 'Catalog Year');
  if (catIdx >= 0) student.catalog_year = lines[catIdx + 1] ?? null;

  const sidIdx = findLine(l => l === 'Student ID');
  if (sidIdx >= 0) student.student_id = lines[sidIdx + 1] ?? null;

  // GPA from summary line e.g. "Cumulative GPA:      3.875"
  const cGpaIdx = findLine(l => l.includes('Cumulative GPA:'));
  if (cGpaIdx >= 0) {
    const m = lines[cGpaIdx].match(/(\d+\.\d+)/);
    if (m) student.gpa.cumulative = parseFloat(m[1]);
  }
  // Major GPA: look for pattern after "Major GPA" heading
  const mjGpaHeadIdx = findLine(l => l === 'Major GPA');
  if (mjGpaHeadIdx >= 0) {
    for (let j = mjGpaHeadIdx + 1; j < Math.min(mjGpaHeadIdx + 10, lines.length); j++) {
      if (/^\d+\.\d{3}$/.test(lines[j]) && lines[j + 1] === 'GPA') {
        student.gpa.major = parseFloat(lines[j]);
        break;
      }
    }
  }

  // ── 2. Credits ──

  const credits: AuditResult['credits'] = {
    completed: null, in_progress: null, needed: null, total_required: 120,
  };

  // Actual text: "Total UG Cumulative Credits - minimum required is 120"
  const creditsSub = Array.from(doc.querySelectorAll('.subrequirement')).find(el =>
    txt(el.querySelector('.subreqTitle')).includes('Total UG Cumulative Credits')
  );
  if (creditsSub) {
    const earnedEl = creditsSub.querySelector('.subreqEarned .hours');
    credits.completed = earnedEl ? parseFloat(txt(earnedEl)) || null : null;
  
    const ipEl = creditsSub.querySelector('.subreqIpHours .hours');
    credits.in_progress = ipEl ? parseFloat(txt(ipEl)) || null : null;
  
    const needsEl = creditsSub.querySelector('.subreqNeeds .hours');
    credits.needed = needsEl ? parseFloat(txt(needsEl)) || null : null;
  }
  // Fallback: calculate needed if not found
  if (credits.needed === null && credits.completed !== null) {
    credits.needed = Math.max(0, 120 - credits.completed - (credits.in_progress ?? 0));
  }

  // ── 3. All Courses (DOM-based, deduplicated) ──

  const seen = new Set<string>();
  const allCourses: CourseEntry[] = [];

  for (const row of doc.querySelectorAll('tr.takenCourse')) {
    const course_id = txt(row.querySelector('.course'));
    const semester = txt(row.querySelector('.term'));
    const key = `${semester}-${course_id}`;
    if (!course_id || !semester || seen.has(key)) continue;
    seen.add(key);
    const grade = txt(row.querySelector('.grade'));
    const ccode = txt(row.querySelector('.ccode'));
    allCourses.push({
      semester, course_id,
      credits: parseFloat(txt(row.querySelector('.credit'))) || 0,
      grade: grade || ccode,
      in_progress: row.classList.contains('ip'),
      title: txt(row.querySelector('.description .descLine')),
    });
  }

  const completedCourses = allCourses.filter(c => !c.in_progress);
  const inProgressCourses = allCourses.filter(c => c.in_progress);

  // ── 4. All Requirements (DOM-based) ──

  const requirementBlocks: RequirementBlock[] = [];

  for (const reqDiv of doc.querySelectorAll('.requirement')) {
    const classes = Array.from(reqDiv.classList);
    const pseudo = reqDiv.getAttribute('pseudo') ?? '';
    const category = classes.find(c => c.startsWith('category_'))?.replace('category_', '') ?? '';
    const status = getReqStatus(reqDiv);
    const title = txt(reqDiv.querySelector('.reqTitle'))
               || txt(reqDiv.querySelector('.reqHeader'));

    const creditsNeededEl = reqDiv.querySelector('.requirementTotals .reqNeeds .hours');
    const totals = reqDiv.querySelector('.requirementTotals');

    const credits_taken = totals
      ? parseFloat(txt(totals.querySelector('.reqEarned .hours'))) || null
      : null;

    const credits_in_progress = totals
      ? parseFloat(txt(totals.querySelector('.reqIpDetail .hours'))) || null
      : null;
    const credits_needed = creditsNeededEl
      ? parseFloat(txt(creditsNeededEl)) || null
      : null;

    const subrequirements: SubrequirementBlock[] = [];

    for (const subDiv of reqDiv.querySelectorAll(
      ':scope > .reqBody > .auditSubrequirements > .subrequirement'
    )) {
      subrequirements.push({
        title: txt(subDiv.querySelector('.subreqTitle')),
        status: getSubStatus(subDiv),
        pseudo: subDiv.getAttribute('pseudo') ?? '',
        courses_taken: extractCourses(subDiv),
        select_from: extractSelectFrom(subDiv),
        needs: extractNeeds(subDiv),
      });
    }

    requirementBlocks.push({
      title, status, pseudo, category,
      credits_taken,
      credits_in_progress,
      credits_needed,
      subrequirements,
    });  }

  // Helper: find a requirement block by its pseudo (rname)
  function findReqByPseudo(p: string) {
    return requirementBlocks.find(r => r.pseudo === p);
  }

  // ── 5a. Upper Level Concentration (CMSC-CONC) ──

  const concReq = findReqByPseudo('CMSC-CONC');
  const concSub = concReq?.subrequirements[0];
  const upper_level_concentration: AuditResult['upper_level_concentration'] = {
    status: concReq?.status ?? 'unknown',
    credits_needed: concSub?.needs
      ? parseFloat(concSub.needs.match(/[\d.]+/)?.[0] ?? '') || null
      : null,
    note: concSub?.title ?? '',
  };

  // ── 5b. Lower Level Requirements (CMSC-LLRQ) ──

  const llReq = findReqByPseudo('CMSC-LLRQ');
  const lower_level_requirements: AuditResult['lower_level_requirements'] = {
    status: llReq?.status ?? 'unknown',
    subrequirements: (llReq?.subrequirements ?? []).map(s => ({
      number: s.title.match(/^\d+\)/) ? s.title.match(/^\d+\)/)?.[0] ?? '' : '',
      title: s.title,
      status: s.status,
      courses_taken: s.courses_taken.map(c => c.course_id),
      needs: s.needs,
      select_from: s.select_from,
    })),
  };

  // ── 5c. Upper Level Requirements (CMSC-ULRQ) ──

  const ulReq = findReqByPseudo('CMSC-ULRQ');
  const ulSubs = ulReq?.subrequirements ?? [];

  // First subreq with no number is the description banner
  const ulDescription = ulSubs.find(s => !s.pseudo || s.pseudo === '')?.title ?? '';

  // Numbered subreqs are the 5 areas
  const ulAreas: UpperLevelArea[] = ulSubs
    .filter(s => s.pseudo && s.pseudo !== '')
    .map(s => {
      const completed = s.courses_taken.filter(c => !c.in_progress).map(c => c.course_id);
      const ip = s.courses_taken.filter(c => c.in_progress).map(c => c.course_id);
      return {
        name: s.title,
        status: s.status,
        courses_taken: completed,
        courses_in_progress: ip,
        select_from: s.select_from,
      };
    });

  const areasFulfilled = ulAreas.filter(a => a.status === 'complete' || a.status === 'in_progress').length;

  const upper_level_requirements: AuditResult['upper_level_requirements'] = {
    status: ulReq?.status ?? 'unknown',
    description: ulDescription,
    areas_fulfilled: areasFulfilled,
    three_areas_met: areasFulfilled >= 3,
    areas: ulAreas,
  };

  // ── 5d. CMSC Electives (CMSC-ELEC) ──

  const elecReq = findReqByPseudo('CMSC-ELEC');
  const elecSub = elecReq?.subrequirements[0];

  // Parse the title to get description and excluded courses
  const elecTitleRaw = elecSub?.title ?? '';
  const elecTitleParts = elecTitleRaw.split(/Not eligible:/i);
  const elecDescription = elecTitleParts[0]?.trim() ?? '';
  const excludedRaw = elecTitleParts[1] ?? '';
  const excluded = excludedRaw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => /^\d+$/.test(s) ? `CMSC${s}` : s.replace(/\s+/g, ''));

  const cmsc_electives: AuditResult['cmsc_electives'] = {
    status: elecReq?.status ?? 'unknown',
    description: elecDescription,
    credits_needed: elecSub?.needs
      ? parseFloat(elecSub.needs.match(/[\d.]+/)?.[0] ?? '') || null
      : null,
    excluded,
    courses_taken: (elecSub?.courses_taken ?? []).filter(c => !c.in_progress).map(c => c.course_id),
    courses_in_progress: (elecSub?.courses_taken ?? []).filter(c => c.in_progress).map(c => c.course_id),
  };

  const genEdReqs = requirementBlocks.filter(r => r.category === 'Gen_Education');

  function findGenEdReq(keyword: string) {
    return genEdReqs.find(r => r.title.includes(keyword) || r.pseudo.includes(keyword));
  }

  function buildGenEdSection(req?: RequirementBlock): GenEdSection {
    if (!req) return { status: 'unknown', subrequirements: [] };
    return {
      status: req.status,
      subrequirements: req.subrequirements.map(s => ({
        code: extractGenEdCode(s.title),
        name: s.title,
        status: s.status,
        courses_taken: s.courses_taken.map(c => c.course_id),
        needs: s.needs,
      })),
    };
  }

  const fsReq  = findGenEdReq('Fundamental Studies');
  const dsReq  = findGenEdReq('Distributive Studies');
  const bqReq  = findGenEdReq('Big Question');
  const divReq = findGenEdReq('Diversity');

  const genEdCredits = findGenEdReq('General Education Required Credits');
  function sumGenEdHours(pseudos: string[], rowClass: string): number | null {
    let total = 0;
    let found = false;
    for (const pseudo of pseudos) {
      const el = doc.querySelector(`[pseudo="${pseudo}"] .${rowClass} .hours`);
      if (el) {
        const val = parseFloat(txt(el));
        if (!isNaN(val)) { total += val; found = true; }
      }
    }
    return found ? total : null;
  }
  
  const genEdSections = ['GENED-FS', 'GENED-DS', 'GENED-IS', 'GENED-DV'];
  const genEdEarned     = sumGenEdHours(genEdSections, 'reqEarned');
  const genEdInProgress = sumGenEdHours(genEdSections, 'reqIpDetail');

  const genEd: AuditResult['gen_ed'] = {
    status: (dsReq?.status === 'unfulfilled' || fsReq?.status === 'unfulfilled')
      ? 'unfulfilled'
      : (bqReq?.status === 'in_progress' || dsReq?.status === 'in_progress')
        ? 'in_progress'
        : 'complete',
    credits_completed:   genEdEarned,
    credits_in_progress: genEdInProgress,
    total_required: 40,
    fundamental_studies: buildGenEdSection(fsReq),
    distributive_studies: buildGenEdSection(dsReq),
    big_question: {
      status: bqReq?.status ?? 'unknown',
      courses_taken: bqReq?.subrequirements
        .flatMap(s => s.courses_taken.map(c => c.course_id)) ?? [],
    },
    diversity: buildGenEdSection(divReq),
    unfulfilled: [],
  };

  // Collect unfulfilled gen ed codes
  [genEd.fundamental_studies, genEd.distributive_studies, genEd.diversity]
    .flatMap(s => s.subrequirements)
    .forEach(s => {
      if (s.status === 'unfulfilled' && s.code) genEd.unfulfilled.push(s.code);
    });

  // ── 6. Summary ──

  return {
    student,
    credits,
    courses: {
      completed: completedCourses,
      in_progress: inProgressCourses,
      all: allCourses,
      completed_ids: completedCourses.map(c => c.course_id),
      in_progress_ids: inProgressCourses.map(c => c.course_id),
    },
    upper_level_concentration,
    lower_level_requirements,
    upper_level_requirements,
    cmsc_electives,
    gen_ed: genEd,
    requirements: requirementBlocks,
    summary: {
      unfulfilled_requirements: requirementBlocks
        .filter(r => r.status === 'unfulfilled')
        .map(r => r.title),
      missing_gen_eds: genEd.unfulfilled,
      credits_still_needed: credits.needed,
    },
  };
}