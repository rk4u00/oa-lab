import { z } from 'zod';

/** oa-challenge.json — the universal repository-debugging challenge manifest. */
export const ChallengeManifest = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  title: z.string(),
  company: z.string().default('generic'),
  category: z.literal('repository-debugging'),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  durationMinutes: z.number().int().positive().default(60),
  description: z.string(),
  /** The same problem in several frameworks: variants share `family.id`, are listed once, and the framework is picked when starting. */
  family: z.object({ id: z.string(), title: z.string() }).optional(),
  /** Markdown file (relative to the challenge dir) shown in the task panel. */
  taskFile: z.string().default('TASK.md'),
  /** Optional AI coach system prompt (relative to the challenge dir). */
  coachPromptFile: z.string().optional(),
  /** Directory (relative to the challenge dir) holding the starter repository. */
  starterDir: z.string().default('starter'),
  runtime: z.object({
    language: z.string(),
    framework: z.string().optional(),
    version: z.string().optional(),
    image: z.string(),
  }),
  workspace: z.object({ root: z.string().default('/workspace'), entrypoint: z.string().optional() }).default({}),
  execution: z.object({
    /** Dependency preparation. Runs ONCE per challenge, with network, before any session; result is cached. */
    setup: z.string().optional(),
    test: z.string(),
    /** junit = JUnit XML file or directory of XML files; jest-json = `jest --json` output; exit-code = whole suite pass/fail. */
    resultFormat: z.enum(['junit', 'jest-json', 'exit-code']).default('junit'),
    resultPath: z.string().default('.oa/results.xml'),
    /** Command used for final grading on submit (defaults to `test`). Runs after hidden files are installed. */
    finalTest: z.string().optional(),
    /** Directory (relative to the challenge dir) copied to `.oa/support/` before every test run (graders, fixtures). */
    supportDir: z.string().optional(),
    /** Directory (relative to the challenge dir) copied to `.oa/hidden/` ONLY for final grading, then removed. */
    hiddenDir: z.string().optional(),
    /** How a test target (file / -k expression / test class) is appended to the test command. Use {target}. */
    targetTemplate: z.string().optional(),
    timeoutSeconds: z.number().int().positive().default(120),
    env: z.record(z.string()).default({}),
  }),
  resources: z.object({
    memoryMb: z.number().int().positive().default(1024),
    cpus: z.number().positive().default(1),
    pids: z.number().int().positive().default(256),
    network: z.boolean().default(false),
  }).default({}),
  scoring: z.object({ type: z.literal('test-pass-rate').default('test-pass-rate'), maxScore: z.number().default(100) }).default({}),
  features: z.object({
    terminal: z.boolean().default(true),
    editor: z.boolean().default(true),
    aiCoach: z.boolean().default(true),
    gitDiff: z.boolean().default(true),
  }).default({}),
  /** Files/dirs hidden from the explorer and protected from edits. */
  readOnly: z.array(z.string()).default([]),
  provenance: z.object({
    source: z.string().default('original'),
    url: z.string().optional(),
    license: z.string().optional(),
    author: z.string().optional(),
  }).default({}),
});
export type ChallengeManifest = z.infer<typeof ChallengeManifest>;

/**
 * Assessment sections. v0.1 implements repository debugging only; DSA, workstyle and
 * behavioral sections will be added as further members of this discriminated union.
 */
export const AssessmentSection = z.discriminatedUnion('kind', [
  z.object({ id: z.string(), kind: z.literal('debugging'), title: z.string(), durationMinutes: z.number(), challenges: z.array(z.string()).min(1) }),
]);
export type AssessmentSection = z.infer<typeof AssessmentSection>;

/** assessment.json — a full assessment profile composed of sections. */
export const AssessmentDefinition = z.object({
  id: z.string(),
  company: z.string(),
  title: z.string(),
  subtitle: z.string().optional(),
  description: z.string(),
  aiAssistance: z.enum(['allowed', 'coach-only', 'disabled']).default('allowed'),
  sections: z.array(AssessmentSection).min(1),
  disclaimer: z.string().optional(),
});
export type AssessmentDefinition = z.infer<typeof AssessmentDefinition>;
