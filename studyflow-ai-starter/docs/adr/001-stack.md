# ADR 001 — Stack choice

## Decision
Используем Next.js + TypeScript + Tailwind + Supabase + OpenAI + Telegram + Vercel.

## Why
- быстрое MVP
- единый репозиторий
- простой deployment
- auth, DB и storage в одном месте

## Consequences
- часть backend-логики остаётся внутри Next.js route handlers
- нужно внимательно разделять UI и server-only код
