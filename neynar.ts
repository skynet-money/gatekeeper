import { NeynarAPIClient } from "@neynar/nodejs-sdk";
import * as dotenv from "dotenv";
dotenv.config()

export async function publishReply(replyText: string, parentHash: string) {
    if (!process.env.NEYNAR_API_KEY) {
        throw new Error("Make sure you set NEYNAR_API_KEY in your .env file");
    }

    const neynarClient = new NeynarAPIClient({ apiKey: process.env.NEYNAR_API_KEY! });

    const reply = await neynarClient.publishCast({
        signerUuid: process.env.SIGNER_UUID!,
        text: replyText,
        parent: parentHash 
    });
    console.log("reply:", reply);
}