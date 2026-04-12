import { describe, expect, it } from "vitest";
import type { Course, JupSection } from "@/lib/api";
import {
  countGenEdTagsSatisfied,
  getCSCourseTier,
  getDownstreamCourseIds,
  removeCoursesWithNoOpenSeats,
  removeGraduateLevelCourses,
  removeIneligibleCourses,
  removeOccupiedTimes,
  sectionConflictsOccupiedPlan,
  sortCSCourses,
  sortGenEdCourses,
} from "@/lib/courses";

function emptyRelationships(
  prereqs: string | null = null,
): Course["relationships"] {
  return {
    prereqs,
    coreqs: null,
    restrictions: null,
    formerly: null,
    additional_info: null,
    also_offered_as: null,
    credit_granted_for: null,
  };
}

function jupSection(open_seats: number, total_seats = 10): JupSection {
  return {
    course_code: "X",
    sec_code: "0101",
    instructors: [],
    meetings: [],
    open_seats,
    total_seats,
    waitlist: 0,
    holdfile: null,
  };
}

function jupSectionMeet(
  open_seats: number,
  meetings: string[],
  sec_code = "0101",
): JupSection {
  return { ...jupSection(open_seats), sec_code, meetings };
}

function makeCourse(
  course_id: string,
  prereqs: string | null = null,
  patch: Partial<Course> = {},
): Course {
  return {
    course_id,
    name: patch.name ?? course_id,
    dept_id: patch.dept_id ?? "CMSC",
    department: patch.department ?? "Computer Science",
    credits: patch.credits ?? "3",
    description: patch.description ?? "",
    semester: patch.semester ?? 202601,
    grading_method: patch.grading_method ?? [],
    gen_ed: patch.gen_ed ?? [],
    core: patch.core ?? [],
    sections: patch.sections ?? [],
    relationships: patch.relationships ?? emptyRelationships(prereqs),
  };
}

describe("removeIneligibleCourses", () => {
  it("drops courses already completed", () => {
    const courses = [
      makeCourse("CMSC132", null),
      makeCourse("CMSC216", "CMSC132"),
    ];
    const out = removeIneligibleCourses(courses, ["CMSC132"], []);
    expect(out.map((c) => c.course_id)).toEqual(["CMSC216"]);
  });

  it("drops courses already in progress", () => {
    const courses = [makeCourse("CMSC132", null), makeCourse("CMSC216", null)];
    const out = removeIneligibleCourses(courses, [], ["CMSC132"]);
    expect(out.map((c) => c.course_id)).toEqual(["CMSC216"]);
  });

  it("keeps courses with no parseable prerequisites", () => {
    const courses = [
      makeCourse("CMSC100", null),
      makeCourse("CMSC101", "Permission of department"),
    ];
    const out = removeIneligibleCourses(courses, [], []);
    expect(out.map((c) => c.course_id).sort()).toEqual(["CMSC100", "CMSC101"]);
  });

  it("removes courses when a required prerequisite is missing", () => {
    const courses = [makeCourse("CMSC216", "Minimum grade of C- in CMSC132")];
    const out = removeIneligibleCourses(courses, [], []);
    expect(out).toHaveLength(0);
  });

  it("keeps courses when all prerequisites are completed", () => {
    const courses = [makeCourse("CMSC216", "Minimum grade of C- in CMSC132")];
    const out = removeIneligibleCourses(courses, ["CMSC132"], []);
    expect(out.map((c) => c.course_id)).toEqual(["CMSC216"]);
  });

  it("treats in-progress courses as satisfying prerequisites", () => {
    const courses = [makeCourse("CMSC216", "CMSC132")];
    const out = removeIneligibleCourses(courses, [], ["CMSC132"]);
    expect(out.map((c) => c.course_id)).toEqual(["CMSC216"]);
  });

  it("requires every extracted prerequisite when several are listed", () => {
    const courses = [
      makeCourse("CMSC999", "CMSC132 and MATH140"),
    ];
    expect(removeIneligibleCourses(courses, ["CMSC132"], []).length).toBe(0);
    expect(
      removeIneligibleCourses(courses, ["CMSC132", "MATH140"], []).length,
    ).toBe(1);
  });
});

describe("removeCoursesWithNoOpenSeats", () => {
  it("removes courses whose sections have zero open seats total", () => {
    const a = { ...makeCourse("CMSC216"), sections: [jupSection(0), jupSection(0)] };
    const b = { ...makeCourse("CMSC330"), sections: [jupSection(2)] };
    expect(
      removeCoursesWithNoOpenSeats([a, b]).map((c) => c.course_id),
    ).toEqual(["CMSC330"]);
  });

  it("removes courses with no sections", () => {
    const x = { ...makeCourse("CMSC132"), sections: [] as JupSection[] };
    expect(removeCoursesWithNoOpenSeats([x])).toHaveLength(0);
  });
});

describe("removeGraduateLevelCourses", () => {
  it("removes 500-level and higher catalog numbers", () => {
    const out = removeGraduateLevelCourses([
      makeCourse("CMSC401"),
      makeCourse("CMSC500"),
      makeCourse("CMSC698"),
    ]);
    expect(out.map((c) => c.course_id)).toEqual(["CMSC401"]);
  });

  it("keeps ids that do not match DEPT+NNN", () => {
    expect(removeGraduateLevelCourses([makeCourse("BAD")])).toHaveLength(1);
  });
});

describe("getDownstreamCourseIds", () => {
  it("returns catalog courses whose prereq text lists the target id", () => {
    const catalog = [
      makeCourse("CMSC216", "Minimum grade of C- in CMSC132"),
      makeCourse("CMSC330", "CMSC216 and CMSC250"),
    ];
    expect(getDownstreamCourseIds(catalog, "CMSC132")).toEqual(["CMSC216"]);
  });

  it("dedupes and sorts by normalized course id", () => {
    const catalog: Course[] = [
      makeCourse("CMSC330", "CMSC216"),
      makeCourse("CMSC351", "CMSC216"),
    ];
    expect(getDownstreamCourseIds(catalog, "CMSC216")).toEqual([
      "CMSC330",
      "CMSC351",
    ]);
  });
});

describe("sortCSCourses / getCSCourseTier", () => {
  it("classifies lower, upper, elective, and other CMSC courses", () => {
    expect(getCSCourseTier("CMSC131")).toBe("lower");
    expect(getCSCourseTier("CMSC330")).toBe("lower");
    expect(getCSCourseTier("CMSC411")).toBe("upper");
    expect(getCSCourseTier("MATH456")).toBe("upper");
    expect(getCSCourseTier("CMSC389")).toBe("electives");
    expect(getCSCourseTier("CMSC122")).toBe("other");
    expect(getCSCourseTier("CMSC500")).toBe("other");
  });

  it("places each course in the matching bucket", () => {
    const items = [
      { course_id: "CMSC389" },
      { course_id: "CMSC411" },
      { course_id: "CMSC131" },
      { course_id: "CMSC122" },
    ];
    const sorted = sortCSCourses(items);
    expect(sorted.lower.map((c) => c.course_id)).toEqual(["CMSC131"]);
    expect(sorted.upper.map((c) => c.course_id)).toEqual(["CMSC411"]);
    expect(sorted.electives.map((c) => c.course_id)).toEqual(["CMSC389"]);
    expect(sorted.other.map((c) => c.course_id)).toEqual(["CMSC122"]);
  });

  it("sorts by unlock count from catalog (desc), then gpa", () => {
    const catalog = [
      makeCourse("CMSC420", "CMSC132"),
      makeCourse("CMSC421", "CMSC132"),
      makeCourse("CMSC422", "CMSC131"),
    ];
    const items = [
      {
        course_id: "CMSC131",
        profs: [{ stars: 5, gpa: 3.5 }],
      },
      {
        course_id: "CMSC132",
        profs: [{ stars: 5, gpa: 3.5 }],
      },
    ];
    const { lower } = sortCSCourses(items, { catalogForUnlocks: catalog });
    // CMSC132 is a prereq for two catalog courses; CMSC131 for one
    expect(lower.map((c) => c.course_id)).toEqual(["CMSC132", "CMSC131"]);
  });

  it("breaks ties on gpa when unlock counts match", () => {
    const items = [
      { course_id: "CMSC131", profs: [{ stars: 3, gpa: 3.0 }] },
      { course_id: "CMSC132", profs: [{ stars: 4, gpa: 2.0 }] },
      { course_id: "CMSC216", profs: [{ stars: 4, gpa: 3.5 }] },
    ];
    const { lower } = sortCSCourses(items, { catalogForUnlocks: [] });
    expect(lower.map((c) => c.course_id)).toEqual([
      "CMSC216",
      "CMSC131",
      "CMSC132",
    ]);
  });

  it("uses explicit unlocks length when provided instead of catalog counts", () => {
    const catalog = [makeCourse("CMSC420", "CMSC131")];
    const items = [
      { course_id: "CMSC131", unlocks: [] },
      { course_id: "CMSC132", unlocks: ["CMSC216", "CMSC330", "CMSC351"] },
    ];
    const { lower } = sortCSCourses(items, { catalogForUnlocks: catalog });
    expect(lower.map((c) => c.course_id)).toEqual(["CMSC132", "CMSC131"]);
  });
});

describe("sortGenEdCourses / countGenEdTagsSatisfied", () => {
  it("counts how many missing tags a course offers (case-insensitive)", () => {
    const c = makeCourse("X", null, { gen_ed: [["dshu", "SCIS"]] });
    expect(countGenEdTagsSatisfied(c, ["DSHU"])).toBe(1);
    expect(countGenEdTagsSatisfied(c, ["DSHU", "SCIS"])).toBe(2);
  });

  it("parses compound missing-tag strings on whitespace", () => {
    const c = makeCourse("X", null, { gen_ed: [["DSHU"], ["SCIS"]] });
    expect(countGenEdTagsSatisfied(c, ["SCIS DSHU"])).toBe(2);
  });

  it("sorts by satisfied missing-tag count descending", () => {
    const missing = ["DSHU", "SCIS"];
    const one = makeCourse("ONE", null, { gen_ed: [["DSHU"]] });
    const two = makeCourse("TWO", null, { gen_ed: [["DSHU"], ["SCIS"]] });
    const out = sortGenEdCourses([one, two], missing);
    expect(out.map((c) => c.course_id)).toEqual(["TWO", "ONE"]);
  });

  it("breaks ties on average gpa (stars ignored)", () => {
    const missing = ["DSHU"];
    const items = [
      {
        ...makeCourse("LOW", null, { gen_ed: [["DSHU"]] }),
        profs: [{ stars: 5, gpa: 2.0 }],
      },
      {
        ...makeCourse("HIGH", null, { gen_ed: [["DSHU"]] }),
        profs: [{ stars: 1, gpa: 3.5 }],
      },
    ];
    const out = sortGenEdCourses(items, missing);
    expect(out.map((c) => c.course_id)).toEqual(["HIGH", "LOW"]);
  });

  it("breaks remaining ties on course_id", () => {
    const missing = ["DSHU"];
    const items = [
      {
        ...makeCourse("ZEBRA", null, { gen_ed: [["DSHU"]] }),
        profs: [{ stars: 4, gpa: 3.0 }],
      },
      {
        ...makeCourse("ALPHA", null, { gen_ed: [["DSHU"]] }),
        profs: [{ stars: 4, gpa: 3.0 }],
      },
    ];
    const out = sortGenEdCourses(items, missing);
    expect(out.map((c) => c.course_id)).toEqual(["ALPHA", "ZEBRA"]);
  });
});

describe("removeOccupiedTimes", () => {
  const occ: { courseNumber: string; meetings: string[] }[] = [
    { courseNumber: "CMSC132", meetings: ["MWF-10:00am-10:50am-ARM-0123"] },
  ];

  it("is a no-op when occupied is empty", () => {
    const c = {
      course_id: "CMSC216",
      sections: [jupSectionMeet(2, ["MWF-10:00am-10:50am-CSI-1115"])],
    };
    expect(removeOccupiedTimes([c], [])).toHaveLength(1);
  });

  it("keeps a course with an open non-overlapping section", () => {
    const c = {
      course_id: "CMSC216",
      sections: [
        jupSectionMeet(2, ["MWF-10:00am-10:50am-CSI-1115"], "0101"),
        jupSectionMeet(2, ["MWF-2:00pm-2:50pm-CSI-1115"], "0102"),
      ],
    };
    expect(removeOccupiedTimes([c], occ).map((x) => x.course_id)).toEqual(["CMSC216"]);
  });

  it("drops a course when every open section overlaps occupied", () => {
    const c = {
      course_id: "CMSC216",
      sections: [jupSectionMeet(2, ["MWF-10:00am-10:50am-CSI-1115"])],
    };
    expect(removeOccupiedTimes([c], occ)).toHaveLength(0);
  });

  it("keeps a course on the plan even if all sections overlap", () => {
    const c = {
      course_id: "CMSC216",
      sections: [jupSectionMeet(2, ["MWF-10:00am-10:50am-CSI-1115"])],
    };
    const onPlan = [{ courseNumber: "CMSC216", meetings: ["T-1:00pm-1:50pm-CSI-1115"] }];
    expect(removeOccupiedTimes([c], onPlan)).toHaveLength(1);
  });

  it("drops full sections from consideration (no open seats)", () => {
    const c = {
      course_id: "CMSC216",
      sections: [
        jupSectionMeet(0, ["MWF-2:00pm-2:50pm-CSI-1115"], "0101"),
        jupSectionMeet(0, ["MWF-10:00am-10:50am-CSI-1115"], "0102"),
      ],
    };
    expect(removeOccupiedTimes([c], occ)).toHaveLength(0);
  });
});

describe("sectionConflictsOccupiedPlan", () => {
  it("flags MWF when plan has MW at the same window (shared days overlap)", () => {
    const plan = [{ courseNumber: "CMSC132", meetings: ["MW-12:00pm-12:50pm-BLD-A"] }];
    const sec = jupSectionMeet(3, ["MWF-12:00pm-12:50pm-BLD-B"], "0101");
    expect(sectionConflictsOccupiedPlan(sec, plan)).toBe(true);
  });

  it("flags partial time overlap on a shared day", () => {
    const plan = [{ courseNumber: "X", meetings: ["MW-12:00pm-12:50pm-BLD-A"] }];
    const sec = jupSectionMeet(3, ["MWF-12:30pm-1:20pm-BLD-B"], "0101");
    expect(sectionConflictsOccupiedPlan(sec, plan)).toBe(true);
  });

  it("does not flag when only F overlaps in name but times are disjoint on shared days", () => {
    const plan = [{ courseNumber: "X", meetings: ["MW-12:00pm-12:50pm-BLD-A"] }];
    const sec = jupSectionMeet(3, ["MWF-2:00pm-2:50pm-BLD-B"], "0101");
    expect(sectionConflictsOccupiedPlan(sec, plan)).toBe(false);
  });

  it("ignores the same course number so sibling sections stay selectable", () => {
    const plan = [{ courseNumber: "CMSC216", meetings: ["MW-10:00am-10:50am-BLD-A"] }];
    const sec = jupSectionMeet(3, ["MW-10:00am-10:50am-BLD-B"], "0102");
    expect(sectionConflictsOccupiedPlan(sec, plan, "CMSC216")).toBe(false);
  });

  it("still flags conflict against a different course", () => {
    const plan = [{ courseNumber: "CMSC132", meetings: ["MW-10:00am-10:50am-BLD-A"] }];
    const sec = jupSectionMeet(3, ["MW-10:00am-10:50am-BLD-B"], "0102");
    expect(sectionConflictsOccupiedPlan(sec, plan, "CMSC216")).toBe(true);
  });
});
