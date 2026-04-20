# Root duplicate migration map

Этот файл фиксирует, куда были перенесены (или уже существовали) удалённые root-файлы,
чтобы было прозрачно, что удаление было очисткой дублей, а не потерей функционала.

## Pages

- `login-page.tsx` → `app/(auth)/login/page.tsx`
- `signup-page.tsx` → `app/(auth)/signup/page.tsx`
- `callback-page.tsx` → `app/(auth)/callback/page.tsx`
- `complete-profile-page.tsx` → `app/(auth)/complete-profile/page.tsx`
- `dashboard-overview.tsx` → `app/dashboard/page.tsx`
- `funnel-page.tsx` → `app/dashboard/funnel/page.tsx`
- `marketing-page.tsx` → `app/(marketing)/page.tsx`
- `root-page.tsx` → `app/page.tsx`

## Layout / styles

- `globals.css` → `app/globals.css`
- `layout.tsx` (root duplicate dashboard shell) → `app/dashboard/layout.tsx`

## Components

- `AuthShell.tsx` → `components/auth/AuthShell.tsx`
- `SidebarNav.tsx` → `components/dashboard/SidebarNav.tsx`
- `GoogleSignInButton.tsx` → `components/auth/GoogleSignInButton.tsx`
- `LogoutButton.tsx` → `components/auth/LogoutButton.tsx`

## Notes

- Корневые варианты удалены намеренно, чтобы не было двух источников правды.
- Каноничными считаются только файлы в `app/` и `components/`.
