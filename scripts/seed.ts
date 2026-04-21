/**
 * Seed-скрипт для StudyFlow AI.
 *
 * Создаёт демо-данные для существующего пользователя (по email):
 *   • заполняет/обновляет profile (университет, факультет, курс)
 *   • создаёт 5 задач (разные приоритеты + статусы)
 *   • создаёт 2 письма (draft + ready)
 *   • создаёт 1 пример документа со статусом "ready" (без эмбеддингов —
 *     для полноценного RAG используй scripts/ingest-documents.ts)
 *   • создаёт 3 синтетических orchestrator_runs для аналитики
 *
 * Идемпотентен: задачи / письма / документы дедуплицируются по title (и subject).
 *
 * Запуск:
 *   USER_EMAIL=you@hse.ru npx tsx scripts/seed.ts
 *
 * Опционально:
 *   USER_EMAIL=you@hse.ru CLEAR=1 npx tsx scripts/seed.ts   # сначала удалить старые seed-записи
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SEED_TAG = "[SEED]";

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.USER_EMAIL;
const clear = process.env.CLEAR === "1";

if (!url || !key || !email) {
  console.error(
    "❌ Требуются env-переменные: SUPABASE_URL (или NEXT_PUBLIC_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY, USER_EMAIL"
  );
  process.exit(1);
}

const supabase = createClient(url, key);

const now = new Date();
function inDays(days: number): string {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

async function findUser(): Promise<{ id: string; email: string }> {
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) throw new Error(`listUsers: ${error.message}`);
  const user = data.users.find((u) => u.email === email);
  if (!user) {
    throw new Error(
      `Пользователь ${email} не найден в auth.users. Сначала зарегистрируйся через UI (/signup или /login).`
    );
  }
  return { id: user.id, email: user.email ?? email! };
}

async function clearOldSeed(client: SupabaseClient, userId: string) {
  console.log("🧹 Удаляю предыдущие seed-записи...");
  await Promise.all([
    client.from("tasks").delete().eq("user_id", userId).like("title", `${SEED_TAG}%`),
    client.from("letters").delete().eq("user_id", userId).like("subject", `${SEED_TAG}%`),
    client.from("documents").delete().eq("user_id", userId).like("title", `${SEED_TAG}%`),
    client.from("orchestrator_runs").delete().eq("user_id", userId).like("input_text", `${SEED_TAG}%`)
  ]);
}

async function upsertProfile(userId: string, userEmail: string) {
  console.log("👤 Обновляю профиль...");

  const { data: existing } = await supabase
    .from("profiles")
    .select("id, full_name, university")
    .eq("id", userId)
    .maybeSingle();

  if (existing && existing.full_name) {
    console.log(`   ✓ Профиль уже заполнен: ${existing.full_name} / ${existing.university ?? "—"}`);
    return;
  }

  const payload = {
    id: userId,
    email: userEmail,
    full_name: "Демо Студент",
    university: "НИУ ВШЭ",
    faculty: "Факультет компьютерных наук",
    group_name: "БПИ-241",
    course_number: 1
  };

  const { error } = existing
    ? await supabase.from("profiles").update(payload).eq("id", userId)
    : await supabase.from("profiles").insert(payload);

  if (error) throw new Error(`profile upsert: ${error.message}`);
  console.log("   ✓ Демо-профиль готов");
}

async function seedTasks(userId: string) {
  console.log("📋 Создаю задачи...");

  const tasks = [
    {
      title: `${SEED_TAG} Сдать ДЗ по линейной алгебре`,
      description: "Решить задачи 1–10 из методички, оформить в LaTeX.",
      due_date: inDays(2),
      status: "in_progress" as const,
      priority: "urgent" as const
    },
    {
      title: `${SEED_TAG} Прочитать главу 3 учебника по матану`,
      description: "Главы про производные сложной функции.",
      due_date: inDays(5),
      status: "pending" as const,
      priority: "high" as const
    },
    {
      title: `${SEED_TAG} Подготовить доклад по «Введению в ИИ»`,
      description: "Тема: трансформеры. 10 слайдов + 5 минут на выступление.",
      due_date: inDays(7),
      status: "pending" as const,
      priority: "medium" as const
    },
    {
      title: `${SEED_TAG} Записаться на консультацию к научнику`,
      description: "Через личный кабинет преподавателя.",
      due_date: inDays(1),
      status: "pending" as const,
      priority: "high" as const
    },
    {
      title: `${SEED_TAG} Прошёл коллоквиум по дискретной математике`,
      description: "Получил 9/10. Можно похвалить себя.",
      due_date: inDays(-3),
      status: "done" as const,
      priority: "low" as const
    }
  ];

  let created = 0;
  let skipped = 0;
  for (const task of tasks) {
    const { data: existing } = await supabase
      .from("tasks")
      .select("id")
      .eq("user_id", userId)
      .eq("title", task.title)
      .maybeSingle();

    if (existing) {
      skipped++;
      continue;
    }

    const { error } = await supabase.from("tasks").insert({ user_id: userId, ...task });
    if (error) {
      console.warn(`   ⚠ insert task failed: ${task.title} — ${error.message}`);
    } else {
      created++;
    }
  }
  console.log(`   ✓ Задачи: создано ${created}, пропущено ${skipped}`);
}

async function seedLetters(userId: string) {
  console.log("✉️  Создаю письма...");

  const letters = [
    {
      subject: `${SEED_TAG} Перенос дедлайна по курсовой работе`,
      body:
        "Уважаемая Ирина Сергеевна,\n\nОбращаюсь к вам с просьбой перенести дедлайн сдачи курсовой работы на одну неделю — с 25 на 30 апреля. Причина: я заболел и неделю не мог полноценно работать (приложу справку).\n\nС уважением,\nДемо Студент, БПИ-241",
      recipient_type: "teacher" as const,
      status: "ready" as const,
      source_prompt: "Письмо преподавателю про перенос дедлайна курсовой из-за болезни"
    },
    {
      subject: `${SEED_TAG} Запрос справки об обучении`,
      body:
        "Здравствуйте,\n\nПрошу выдать справку об обучении (форма 26) для предоставления в военкомат. Готов получить лично или в электронном виде.\n\nСпасибо,\nДемо Студент",
      recipient_type: "dean_office" as const,
      status: "draft" as const,
      source_prompt: "Заявление в учебный офис на справку для военкомата"
    }
  ];

  let created = 0;
  let skipped = 0;
  for (const letter of letters) {
    const { data: existing } = await supabase
      .from("letters")
      .select("id")
      .eq("user_id", userId)
      .eq("subject", letter.subject)
      .maybeSingle();

    if (existing) {
      skipped++;
      continue;
    }

    const { error } = await supabase.from("letters").insert({ user_id: userId, ...letter });
    if (error) {
      console.warn(`   ⚠ insert letter failed: ${letter.subject} — ${error.message}`);
    } else {
      created++;
    }
  }
  console.log(`   ✓ Письма: создано ${created}, пропущено ${skipped}`);
}

async function seedDocument(userId: string) {
  console.log("📄 Создаю пример документа (без эмбеддингов)...");

  const title = `${SEED_TAG} Лекция: Производные сложной функции`;

  const { data: existing } = await supabase
    .from("documents")
    .select("id")
    .eq("user_id", userId)
    .eq("title", title)
    .maybeSingle();

  if (existing) {
    console.log("   ✓ Документ уже существует — пропускаю");
    return;
  }

  const { error } = await supabase.from("documents").insert({
    user_id: userId,
    title,
    file_path: null,
    mime_type: "text/plain",
    source_type: "manual",
    processing_status: "ready"
  });

  if (error) {
    console.warn(`   ⚠ insert document failed: ${error.message}`);
  } else {
    console.log("   ✓ Документ создан (для полного RAG используй scripts/ingest-documents.ts)");
  }
}

async function seedOrchestratorRuns(userId: string) {
  console.log("📊 Создаю синтетические orchestrator_runs для аналитики...");

  const runs = [
    {
      input_text: `${SEED_TAG} Помоги составить план подготовки к экзамену`,
      detected_intent: "study_plan",
      selected_workflow: "study_plan",
      confidence: 0.92,
      status: "completed",
      channel: "web",
      latency_ms: 2400
    },
    {
      input_text: `${SEED_TAG} Письмо преподавателю про перенос дедлайна`,
      detected_intent: "letter_generator",
      selected_workflow: "letter_generator",
      confidence: 0.88,
      status: "completed",
      channel: "web",
      latency_ms: 3100
    },
    {
      input_text: `${SEED_TAG} Что такое матрица Якоби?`,
      detected_intent: "rag_qa",
      selected_workflow: "rag_qa",
      confidence: 0.81,
      status: "completed",
      channel: "telegram",
      latency_ms: 1800
    }
  ];

  let created = 0;
  for (const run of runs) {
    const { data: existing } = await supabase
      .from("orchestrator_runs")
      .select("id")
      .eq("user_id", userId)
      .eq("input_text", run.input_text)
      .maybeSingle();

    if (existing) continue;

    const { error } = await supabase.from("orchestrator_runs").insert({ user_id: userId, ...run });
    if (error) {
      console.warn(`   ⚠ insert run failed: ${error.message}`);
    } else {
      created++;
    }
  }
  console.log(`   ✓ Runs: создано ${created}`);
}

async function main() {
  console.log(`\n🌱 StudyFlow AI seed для ${email}\n`);

  const user = await findUser();
  console.log(`✓ Найден пользователь: ${user.id}`);

  if (clear) {
    await clearOldSeed(supabase, user.id);
  }

  await upsertProfile(user.id, user.email);
  await seedTasks(user.id);
  await seedLetters(user.id);
  await seedDocument(user.id);
  await seedOrchestratorRuns(user.id);

  console.log("\n✅ Seed завершён. Открой http://localhost:3000/dashboard\n");
}

main().catch((err) => {
  console.error("\n❌ Seed failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
