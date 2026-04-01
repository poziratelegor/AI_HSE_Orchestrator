export async function runCheatSheet(text: string) {
  return {
    ok: true,
    workflow: "cheat_sheet",
    summary: "Cheat Sheet placeholder",
    data: {
      bullets: [
        "Ключевая мысль 1",
        "Ключевая мысль 2",
        "Ключевая мысль 3"
      ],
      sourceText: text
    }
  };
}
