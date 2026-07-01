/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Standardizes date formatting into a local YYYY-MM-DD string representation,
 * avoiding UTC offset date shifts.
 */
export function toLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
