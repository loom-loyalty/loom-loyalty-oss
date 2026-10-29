import { DEFAULT_STALE_TIMES } from "../constants";
import { PIPES } from "../pipes";
import type { DateRange, ProgramsEnrollmentRow } from "../types";
import { useTinybirdQuery } from "./use-tinybird-query";

export function useProgramsEnrollment(dateRange: DateRange) {
  return useTinybirdQuery<typeof PIPES.PROGRAMS_ENROLLMENT, ProgramsEnrollmentRow>(
    PIPES.PROGRAMS_ENROLLMENT,
    { start_date: dateRange.startDate, end_date: dateRange.endDate },
    { staleTime: DEFAULT_STALE_TIMES.distribution }
  );
}
