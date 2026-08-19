/**
 * lib/whatsapp-groups.ts
 * ────────────────────────
 * Hardcoded list of allowed WhatsApp groups.
 * Only name + id are exposed — no gateway secrets ever appear here.
 * This file is safe to import in server components and API routes.
 */

export interface WhatsAppGroup {
  id: string;   // @g.us JID
  name: string;
}

/** The two production groups for BABIOS reminders */
export const WHATSAPP_GROUPS: WhatsAppGroup[] = [
  {
    id: '120363403007632805@g.us',
    name: '{ TRENDHIVE }',
  },
  {
    id: '120363427233548997@g.us',
    name: 'Made in 20s - work',
  },
];

/** Lookup a group by JID — returns undefined if not in the allowed list */
export function findGroupById(id: string): WhatsAppGroup | undefined {
  return WHATSAPP_GROUPS.find(g => g.id === id);
}

/** Validate that a given JID is in the allowed list */
export function isValidGroupId(id: string): boolean {
  return WHATSAPP_GROUPS.some(g => g.id === id);
}
