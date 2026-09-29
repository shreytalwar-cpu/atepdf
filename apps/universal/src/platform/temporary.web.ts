// atePDF's disposable local copies (ADR 0010 temporary work). The browser keeps none
// outside the tab, so there is nothing to measure or remove here.
export type TemporaryFiles={
  /** Bytes in atePDF's private temporary folders, or null when they can't be measured. */
  usage():number|null;
  /** Remove every file in them; false when some could not be removed. Call only when no job or export is running. */
  clear():boolean;
};
type TestHook={temporary?:TemporaryFiles};
export const temporaryFiles:TemporaryFiles|null=(globalThis as {__ATEPDF_TEST_WORKSPACE__?:TestHook}).__ATEPDF_TEST_WORKSPACE__?.temporary??null;
