/**
 * Client-side HTML sanitizer for rich-text content rendered in 'use client' components.
 *
 * Uses the browser DOM to strip dangerous elements (script, iframe, etc.) and
 * event-handler / javascript: attributes. Safe to import in any 'use client' file.
 *
 * For server-side sanitization (Server Components, Server Actions), use sanitizeRichHtml
 * from '@/lib/sanitize' instead.
 */
export function sanitizeClientHtml(html: string): string {
  if (typeof document === 'undefined') return html
  const tmp = document.createElement('div')
  tmp.innerHTML = html
  tmp.querySelectorAll('script, style, iframe, object, embed, form').forEach(el => el.remove())
  tmp.querySelectorAll('*').forEach(el => {
    Array.from(el.attributes).forEach(attr => {
      if (
        attr.name.startsWith('on') ||
        attr.value.toLowerCase().trim().startsWith('javascript:')
      ) {
        el.removeAttribute(attr.name)
      }
    })
  })
  return tmp.innerHTML
}
