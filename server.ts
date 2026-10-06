// server.ts
// Start with: deno run --allow-net --allow-env --env-file=.env server.ts

import { game } from "./game.ts";

interface Player { id: string; name: string; ws: WebSocket }
interface Room { id: string; players: Player[]; state: ReturnType<typeof game.setup> | null; inputs: Record<string, string>; bot?: Promise<string> }

const rooms = new Map<string, Room>();

Deno.serve({ port: 8080 }, (req) => {
  if (req.headers.get("upgrade") !== "websocket") return new Response("Game server is running!");

  const { socket, response } = Deno.upgradeWebSocket(req);
  guardSocket(socket); // comment this line to disable idle/max timeout for testing (careful on Deno Deploy free plan)
  let room: Room | undefined;
  let me: Player | undefined;

  socket.onmessage = async (e) => {
    const msg = JSON.parse(e.data);

    // A player joins a room. The game starts once enough players are there.
    if (msg.type === "join" && !me) {
      const roomId = msg.roomId || "lobby";
      if (!rooms.has(roomId)) rooms.set(roomId, { id: roomId, players: [], state: null, inputs: {} });
      room = rooms.get(roomId)!;
      if (room.state) return socket.send(JSON.stringify({ type: "error", message: "Game already running." }));

      me = { id: crypto.randomUUID(), name: msg.name || "Anonymous", ws: socket };
      room.players.push(me);
      broadcast(room, { type: "waiting", players: room.players.map((p) => p.name) });

      if (room.players.length === game.players) {
        room.state = game.setup(room.players);
        startRound(room);
      }
    }

    // A player submits their text. Once everyone has, the round ends.
    const r = room;
    if (msg.type === "submit" && r?.state && me && !(me.id in r.inputs)) {
      r.inputs[me.id] = String(msg.text).slice(0, 200);
      if (r.players.every((p) => p.id in r.inputs)) await endRound(r);
    }
  };

  // If someone leaves, the room is closed for everyone. They can simply join again.
  socket.onclose = () => {
    if (!room || rooms.get(room.id) !== room) return;
    rooms.delete(room.id);
    for (const p of room.players) p.ws.close(1000, "A player left the game.");
  };

  return response;
});

function startRound(room: Room) {
  room.inputs = {};
  broadcast(room, { type: "round", prompt: game.startRound(room.state!) });
  room.bot = game.botInput(room.state!); // the AI writes at the same time as the players
}

async function endRound(room: Room) {
  room.inputs.bot = await room.bot!;
  const result = game.endRound(room.state!, room.inputs);
  broadcast(room, { type: "results", ...result });

  if (result.gameOver) rooms.delete(room.id);
  else setTimeout(() => startRound(room), 8000); // time to read the results
}

function broadcast(room: Room, msg: object) {
  for (const p of room.players) {
    if (p.ws.readyState === WebSocket.OPEN) p.ws.send(JSON.stringify(msg));
  }
}


// When using Deno Deploy, the free plan's quota can be conserved by closing sockets that are idle or have been connected for too long
const IDLE_MS = 10 * 60 * 1000;     // close connection after 10 minutes of inactivity
const MAX_MS = 4 * 60 * 60 * 1000;  // close the connection after 4 hours

function guardSocket(socket: WebSocket) {
  let idle: number | undefined;
  const resetIdle = () => {
    clearTimeout(idle);
    idle = setTimeout(() => socket.close(4000, "idle timeout"), IDLE_MS);
  };
  const max = setTimeout(() => socket.close(4001, "max duration"), MAX_MS);

  socket.addEventListener("open", resetIdle);
  socket.addEventListener("message", resetIdle);
  socket.addEventListener("close", () => {
    clearTimeout(idle);
    clearTimeout(max);
  });
}