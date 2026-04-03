export async function runLetterGenerator(text: string) {
  return {
    ok: true,
    workflow: "letter_generator",
    summary: "Official letter placeholder",
    data: {
      subject: "Официальное обращение",
      body: `Уважаемый преподаватель!\n\n${text}\n\nС уважением,\nСтудент`
    }
  };
}
