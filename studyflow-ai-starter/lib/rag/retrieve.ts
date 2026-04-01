export async function retrieveRelevantChunks(query: string) {
  return [
    {
      id: "placeholder-chunk",
      text: `Stub retrieval result for query: ${query}`
    }
  ];
}
