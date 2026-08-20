/**
 * Rirekisho has a fixed Japanese display vocabulary. This projects the
 * established CV editor values at the presentation boundary without changing
 * the persisted structured value.
 */
export type RirekishoGenderDisplay = '男' | '女' | 'その他' | '';

export function projectRirekishoGenderDisplay(gender?: string): RirekishoGenderDisplay {
  switch (String(gender || '').trim()) {
    case 'male':
    case '男':
      return '男';
    case 'female':
    case '女':
      return '女';
    // This is the established neutral option in the Japan-region CV editor.
    case 'その他':
      return 'その他';
    default:
      // Unknown and empty persisted values remain unselected/blank rather
      // than being rewritten or collapsed into the Japanese neutral option.
      return '';
  }
}
