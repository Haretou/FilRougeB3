# Contacts Feature — Design Spec

**Date:** 2026-07-01  
**Feature:** Contacts tab for sharing encrypted files  
**Status:** Approved

---

## Goal

Allow users to save a list of trusted contacts (name + email) so they can share encrypted files in one click from the file explorer, instead of typing an email address manually each time.

---

## Architecture

### Data layer

New MySQL table `contacts`:

```sql
CREATE TABLE contacts (
  id         VARCHAR(36)  NOT NULL DEFAULT (UUID()),
  owner_id   VARCHAR(36)  NOT NULL,
  name       VARCHAR(100) NOT NULL,
  email      VARCHAR(255) NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_owner_email (owner_id, email)
);
```

- `owner_id` links to `users.id` — contacts are private to each user.
- `(owner_id, email)` is unique: you can't save the same email twice.

### API

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/contacts` | List contacts for the authenticated user |
| POST | `/api/contacts` | Create a new contact |
| PATCH | `/api/contacts/[id]` | Update name and/or email |
| DELETE | `/api/contacts/[id]` | Delete a contact |

All routes require a valid session (same `getSessionUser` pattern used in passwords and files).

Payload for POST / PATCH: `{ name: string, email: string }`

### Frontend — `/dashboard/contacts` page

New page added to the sidebar, between "Mots de passe" and the existing links.

Layout mirrors the passwords page style:
- **Header bar**: title "Contacts", subtitle "N contacts enregistrés", "+ Nouveau contact" button
- **Search bar**: client-side filter by name or email (no extra API call)
- **Contact list**: one card per contact
  - **Avatar**: 32×32 circle, background color derived from initials (6 deterministic colors), 2-letter initials (first letter of first name + first letter of last name)
  - **Name** (bold) + **email** (muted)
  - Three action buttons: **↗ Partager** (purple), **✏️ Edit** (neutral), **🗑 Delete** (red outline)
- **Add / Edit modal**: small overlay with Name and Email inputs + Save/Cancel

"↗ Partager" on a contact card opens the existing share modal pre-populated with that contact's email.

### Frontend — Updated Share Modal (in `FileExplorer.tsx`)

The existing share modal currently has a single email input. It will be updated:

1. **"Mes contacts" section** (shown first if user has contacts):
   - Fetches `/api/contacts` on modal open
   - Renders clickable contact rows (avatar + name + email); clicking one selects it (highlighted in purple, checkmark shown)
   - Only one contact can be selected at a time
2. **Divider** "ou saisir manuellement"
3. **Email input** (pre-filled when a contact is selected; can still type freely)
4. **Submit button**: label changes to "↗ Partager avec [Name]" when a contact is selected, otherwise "↗ Partager"

The actual share logic (POST /api/files/[id]/share) is unchanged; only the email resolution changes.

---

## Component / File Map

| File | Action | Purpose |
|------|--------|---------|
| `db/init/02-contacts.sql` | Create | Migration: `contacts` table |
| `src/app/api/contacts/route.ts` | Create | GET + POST handlers |
| `src/app/api/contacts/[id]/route.ts` | Create | PATCH + DELETE handlers |
| `src/app/dashboard/contacts/page.tsx` | Create | Contacts page (list + modals) |
| `src/app/dashboard/layout.tsx` | Modify | Add "Contacts" link to sidebar |
| `src/app/dashboard/_components/FileExplorer.tsx` | Modify | Update share modal with contacts picker |

---

## Error Handling

- Duplicate email on POST → 409 Conflict with message "Ce contact existe déjà"
- Invalid email format → 400 Bad Request (validated client-side; API also validates with regex)
- Missing name or email → 400 Bad Request
- Contact not found / not owned → 404

---

## Testing Criteria

- Can create a contact and see it in the list immediately
- Search filters by name and by email
- Edit updates name and/or email in place
- Delete removes the card; "N contacts enregistrés" count updates
- Share modal shows contacts when user has at least one
- Clicking a contact selects it and pre-fills the email field
- Can still type a free-form email when no contact is selected
- Share modal works normally (no regression) when user has zero contacts
