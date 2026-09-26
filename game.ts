// game.ts
// The rules of the game: each round there is a word, and everyone –
// the AI too – writes the craziest sentence they can think of with it.

import { askMistral } from "./mistral.ts";

const ROUNDS = 5;
const WORDS = ["cactus", "penguin", "toaster", "unicorn", "volcano", "garden gnome", "octopus", "homework", "wizard"];

interface State { players: { id: string; name: string }[]; round: number; word: string }

export const game = {
  players: 2, // the game starts as soon as this many players have joined

  setup(players: State["players"]): State {
    return { players, round: 0, word: "" };
  },

  // A new round begins: returns the text all players see
  startRound(state: State): string {
    state.round++;
    state.word = WORDS[Math.floor(Math.random() * WORDS.length)];
    return `Round ${state.round}/${ROUNDS}: Write a crazy sentence with the word "${state.word}"`;
  },

  // What does the AI write?
  async botInput(state: State): Promise<string> {
    const prompt = `Write ONE crazy, funny sentence (max. 20 words) containing the word "${state.word}". ` +
      "Reply with only the sentence.";
    return await askMistral(prompt) ?? "The AI is speechless.";
  },

  // Everyone has submitted (inputs: player ID → text, the AI is "bot")
  endRound(state: State, inputs: Record<string, string>) {
    const entries = state.players.map((p) => ({ name: p.name, text: inputs[p.id] }));
    entries.push({ name: "🤖 AI", text: inputs.bot });
    return { title: `The word was: ${state.word}`, entries, gameOver: state.round >= ROUNDS };
  },
};
