// mistral.ts
// Sends a prompt to Mistral. The key comes from the environment (.env), never from the code!

export async function askMistral(prompt: string): Promise<string | null> {
  try {
    const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("MISTRAL_API_KEY")}`,
      },
      body: JSON.stringify({
        model: "mistral-small-latest",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`Mistral HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.choices[0].message.content.trim().replace(/^"|"$/g, "");
  } catch (err) {
    console.error(err);
    return null;
  }
}
