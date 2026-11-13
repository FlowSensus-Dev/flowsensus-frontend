/**
 * Validates Simple Exponential Smoothing (SES) smoothing factor (alpha).
 * Alpha must be a non-empty, finite number in the half-open interval (0, 1].
 */
export function validAlpha(value: string): boolean {
  return value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) > 0 && Number(value) <= 1;
}

