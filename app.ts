import { initializeAgent, runAgent } from "./agent";
import { publishReply } from "./neynar";

import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  console.log("starting agent...")
  const { agent, config, wallet } = await initializeAgent();
  const server = Bun.serve({
    port: 3000,
    async fetch(req) {
      try {
        const request = await req.json();

        console.log(request)

        const hash = request.data.hash;

        console.log("hash : ", hash)

        console.log("user: ", request.data.author.username)
        console.log("text: ", request.data.text)

        const reply = await runAgent(agent, config, request.data.author.username, request.data.text);

        console.log("reply: ", reply)

        await publishReply(reply, hash);

        return new Response("OK");
      } catch (e: any) {
        console.error("Error: ", e)
        return new Response(e.message, { status: 500 });
      }
    },
  });

  console.log(`Listening on localhost:${server.port}`);
}


if (require.main === module) {
  console.log("Starting Agent...");
  main().catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
