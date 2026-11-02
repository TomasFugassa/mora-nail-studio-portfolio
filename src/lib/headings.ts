/** Presentation rule for headings; paragraph punctuation and saved content stay intact. */
export function headingText(value: string): string {
  return value.replace(/\.+(?=\s*(?:\r?\n|$))/g, '');
}
