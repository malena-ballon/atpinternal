/**
 * Server-side HTML sanitizer for TipTap rich-text content.
 *
 * Uses sanitize-html with a strict allowlist so that only the tags and
 * attributes produced by TipTap are preserved. Everything else (script,
 * event handlers, javascript: URLs, etc.) is stripped before content
 * is stored in the database or rendered publicly.
 *
 * Import only from server-side code (Server Components, Server Actions,
 * Route Handlers). Never import this in a 'use client' file.
 */

import sanitizeHtml from 'sanitize-html'

/** Tags that TipTap's StarterKit + extensions can produce */
const ALLOWED_TAGS = [
  // Block
  'p', 'blockquote', 'pre',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'br', 'hr',
  // Inline
  'strong', 'b', 'em', 'i', 'u', 's', 'del', 'code',
  // TipTap Highlight
  'mark',
  // TipTap TaskList
  'ul', 'li', 'input',
  // Links
  'a',
]

const ALLOWED_ATTRS: sanitizeHtml.IOptions['allowedAttributes'] = {
  // Links — force safe target and rel
  a: ['href', 'rel', 'target'],
  // TipTap task-list checkboxes
  input: ['type', 'checked', 'disabled'],
  // Code blocks
  pre: ['class'],
  code: ['class'],
}

const sanitizeOptions: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: ALLOWED_ATTRS,
  // Strip disallowed tags entirely (do not escape them as text)
  disallowedTagsMode: 'discard',
  // Force safe link protocols — block javascript: data: vbscript:
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: { a: ['http', 'https', 'mailto'] },
  // Add rel="noopener noreferrer" to all links automatically
  transformTags: {
    a: (_tagName, attribs) => ({
      tagName: 'a',
      attribs: {
        ...attribs,
        rel: 'noopener noreferrer',
        target: '_blank',
      },
    }),
  },
}

/**
 * Sanitize a TipTap HTML string for safe storage and public rendering.
 * Returns an empty string for falsy input.
 */
export function sanitizeRichHtml(html: string | null | undefined): string {
  if (!html) return ''
  return sanitizeHtml(html, sanitizeOptions)
}
