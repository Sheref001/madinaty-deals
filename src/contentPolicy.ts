const urlPattern = /(?:\b(?:https?|ftp):\/\/|\bwww\.)\S+|\b(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?/i;
const socialHandlePattern = /(?:^|\s)@[a-z0-9_.-]{2,}|\b(?:instagram|facebook|tiktok|linkedin|youtube|threads|twitter|snapchat)\s*(?:[:/@]\s*)[a-z0-9_.-]{2,}/i;
const markupPattern = /<\s*\/?\s*[a-z!][^>]*>?|\bjavascript\s*:/i;

export type DescriptionPolicyViolation = 'Community Content Policy violation: tutoring descriptions cannot include links, email addresses, or social media handles. Use the social account field instead.' | 'HTML and script content are not allowed in service descriptions.';

export function getDescriptionPolicyViolation(description: string, educational: boolean): DescriptionPolicyViolation | '' {
  if (markupPattern.test(description)) return 'HTML and script content are not allowed in service descriptions.';
  if (educational && (urlPattern.test(description) || socialHandlePattern.test(description))) {
    return 'Community Content Policy violation: tutoring descriptions cannot include links, email addresses, or social media handles. Use the social account field instead.';
  }
  return '';
}
