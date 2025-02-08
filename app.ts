import { initializeAgent, runAgent } from "./agent";
import { publishReply } from "./neynar";
import { createHmac } from "crypto";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  console.log("starting agent...")
  const { agent, config, wallet } = await initializeAgent();
  const server = Bun.serve({
    port: 3000,
    async fetch(req) {
      try {
        const request = await req.text();

        const sig = req.headers.get("X-Neynar-Signature");
        if (!sig) {
          throw new Error("Neynar signature missing from request headers");
        }

        const webhookSecret = process.env.NEYNAR_WEBHOOK_SECRET;
        if (!webhookSecret) {
          throw new Error("Make sure you set NEYNAR_WEBHOOK_SECRET in your .env file");
        }

        const hmac = createHmac("sha512", webhookSecret);
        hmac.update(request);

        const generatedSignature = hmac.digest("hex");

        const isValid = generatedSignature === sig;
        if (!isValid) {
          throw new Error("Invalid webhook signature");
        }

        console.log(request)

        const hookData = JSON.parse(request);

        const hash = hookData.data.hash;

        console.log("hash : ", hash)

        console.log("user: ", hookData.data.author.username)
        console.log("text: ", hookData.data.text)

        const reply = await runAgent(agent, config, hookData.data.author.username, hookData.data.text);

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
