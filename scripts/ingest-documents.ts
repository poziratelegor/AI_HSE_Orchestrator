/**
 * CLI batch-ingestion документов в RAG.
 *
 * Берёт локальный файл или папку, загружает каждый файл в Supabase Storage
 * (bucket "documents"), создаёт запись в documents и запускает processDocument
 * (chunk → embed → pgvector). Идемпотентен: дубликаты по title пропускаются.
 *
 * Поддерживаемые форматы: .pdf, .txt, .md
 *
 * Запуск:
 *   USER_EMAIL=you@hse.ru npx tsx scripts/ingest-documents.ts ./materials/
 *   USER_EMAIL=you@hse.ru npx tsx scripts/ingest-documents.ts ./lecture.pdf
 *
 * Опционально:
 *   FORCE=1 — пересоздать документ, если уже есть (удалит старые чанки)
 */

import { createClient } from "@supabase/supabase-js";
import { readFile, readdir, stat } from "fs/promises";
import { extname, basename, join, resolve } from "path";

import { processDocument } from "@/lib/services/documents/ingestion";

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.USER_EMAIL;
const force = process.env.FORCE === "1";

const inputPath = process.argv[2];

if (!url || !key || !email || !inputPath) {
  console.error(
    "Использование:\n  USER_EMAIL=you@hse.ru npx tsx scripts/ingest-documents.ts <path>\n\n" +
      "Требуются env: SUPABASE_URL (или NEXT_PUBLIC_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY, USER_EMAIL"
  );
  process.exit(1);
}

const supabase = createClient(url, key);

const SUPPORTED_EXTENSIONS = new Set([".pdf", ".txt", ".md"]);
const MIME_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".md": "text/plain"
};

type IngestStats = { processed: number; skipped: number; failed: number };

async function findUserId(): Promise<string> {
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) throw new Error(`listUsers: ${error.message}`);
  const user = data.users.find((u) => u.email === email);
  if (!user) {
    throw new Error(
      `Пользователь ${email} не найден в auth.users. Зарегистрируйся через UI и повтори.`
    );
  }
  return user.id;
}

async function collectFiles(target: string): Promise<string[]> {
  const absolute = resolve(target);
  const stats = await stat(absolute);

  if (stats.isFile()) {
    return [absolute];
  }

  if (stats.isDirectory()) {
    const entries = await readdir(absolute);
    const files: string[] = [];
    for (const entry of entries) {
      const full = join(absolute, entry);
      const entryStats = await stat(full);
      if (entryStats.isFile() && SUPPORTED_EXTENSIONS.has(extname(entry).toLowerCase())) {
        files.push(full);
      }
    }
    return files;
  }

  throw new Error(`Путь не является файлом или папкой: ${absolute}`);
}

async function ensureBucket() {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) {
    console.warn(`⚠ listBuckets: ${error.message} — пробую создать bucket "documents"`);
  }

  const exists = buckets?.some((b) => b.name === "documents");
  if (!exists) {
    const { error: createErr } = await supabase.storage.createBucket("documents", {
      public: false
    });
    if (createErr && !createErr.message.includes("already exists")) {
      throw new Error(`createBucket: ${createErr.message}`);
    }
    console.log('✓ Bucket "documents" создан');
  }
}

async function ingestFile(userId: string, filePath: string, stats: IngestStats) {
  const fileName = basename(filePath);
  const ext = extname(filePath).toLowerCase();
  const mimeType = MIME_TYPES[ext];

  if (!mimeType) {
    console.log(`⚠ ${fileName}: формат ${ext} не поддерживается, пропускаю`);
    stats.skipped++;
    return;
  }

  // Dedup by title
  const { data: existing } = await supabase
    .from("documents")
    .select("id, processing_status")
    .eq("user_id", userId)
    .eq("title", fileName)
    .maybeSingle();

  if (existing && !force) {
    console.log(`⏭  ${fileName}: уже существует (${existing.processing_status}). FORCE=1 для пересоздания.`);
    stats.skipped++;
    return;
  }

  if (existing && force) {
    console.log(`🔄 ${fileName}: FORCE=1, удаляю старые чанки`);
    await supabase.from("document_chunks").delete().eq("document_id", existing.id);
    await supabase.from("documents").delete().eq("id", existing.id);
  }

  console.log(`📥 ${fileName}: чтение...`);
  const buffer = await readFile(filePath);
  const storagePath = `${userId}/${Date.now()}_${fileName}`;

  console.log(`☁️  ${fileName}: загрузка в Storage (${(buffer.length / 1024).toFixed(1)} KB)...`);
  const { error: uploadErr } = await supabase.storage
    .from("documents")
    .upload(storagePath, buffer, { contentType: mimeType, upsert: false });

  if (uploadErr) {
    console.warn(`   ❌ upload failed: ${uploadErr.message}`);
    stats.failed++;
    return;
  }

  console.log(`📝 ${fileName}: создаю запись documents...`);
  const documentId = crypto.randomUUID();
  const { error: insertErr } = await supabase.from("documents").insert({
    id: documentId,
    user_id: userId,
    title: fileName,
    file_path: storagePath,
    mime_type: mimeType,
    source_type: "manual_ingestion",
    file_size_bytes: buffer.length,
    processing_status: "pending"
  });

  if (insertErr) {
    console.warn(`   ❌ insert failed: ${insertErr.message}`);
    stats.failed++;
    return;
  }

  console.log(`⚙️  ${fileName}: chunk → embed → pgvector...`);
  await processDocument({ documentId, storagePath, mimeType });

  // Re-read final status
  const { data: finalDoc } = await supabase
    .from("documents")
    .select("processing_status, error_message")
    .eq("id", documentId)
    .single();

  if (finalDoc?.processing_status === "ready") {
    console.log(`   ✅ ${fileName}: ready`);
    stats.processed++;
  } else if (finalDoc?.processing_status === "partial") {
    console.log(`   ⚠ ${fileName}: partial (${finalDoc.error_message ?? "—"})`);
    stats.processed++;
  } else {
    console.log(`   ❌ ${fileName}: ${finalDoc?.processing_status} — ${finalDoc?.error_message ?? "нет деталей"}`);
    stats.failed++;
  }
}

async function main() {
  console.log(`\n📚 StudyFlow ingestion для ${email}\n`);

  const userId = await findUserId();
  console.log(`✓ User: ${userId}`);

  await ensureBucket();

  const files = await collectFiles(inputPath!);
  if (files.length === 0) {
    console.log("⚠ Не найдено поддерживаемых файлов (.pdf, .txt, .md)");
    return;
  }

  console.log(`✓ Найдено ${files.length} файл(ов):\n  ${files.map((f) => basename(f)).join("\n  ")}\n`);

  const stats: IngestStats = { processed: 0, skipped: 0, failed: 0 };

  for (const file of files) {
    try {
      await ingestFile(userId, file, stats);
    } catch (err) {
      console.error(`   ❌ ${basename(file)}: ${err instanceof Error ? err.message : err}`);
      stats.failed++;
    }
  }

  console.log(
    `\n📊 Итого: обработано ${stats.processed}, пропущено ${stats.skipped}, ошибок ${stats.failed}\n`
  );
}

main().catch((err) => {
  console.error("\n❌ Ingestion failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
