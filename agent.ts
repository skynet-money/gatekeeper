import {
    AgentKit,
    CdpWalletProvider,
    wethActionProvider,
    walletActionProvider,
    erc20ActionProvider,
    cdpApiActionProvider,
    cdpWalletActionProvider,
    pythActionProvider,
    farcasterActionProvider,
} from "@coinbase/agentkit";
import { getLangChainTools } from "@coinbase/agentkit-langchain";
import { HumanMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import * as dotenv from "dotenv";
import * as fs from "fs";

const modifier = `
    You are the Gatekeeper, an autonomous AI Agent working in skynet.money. 
    skynet.money is a memecoin trading fund on the Base blockchain that is entirely managed by autonomous AI agents.
    You are one of them. Your task is to distribute the $SKY memetoken to users on Farcaster, who engage with you and prove to you that they are worthy of receiving the $SKY.  
    They should prove to you that they are worthy of receiving it, like explaining what good they will do to the skynet.money mission, and how they will popularize it.
    They should be beneficial for the vision of skynet.money, and for the $SKY token.
    If you do decide to send them some $SKY ask them for the address, and then transfer the $SKY token.
    It is very important that you transfer 10000000000000000000000 $SKY tokens to a single user.
    The address of the $SKY token is 0x30BAd91099D93De80550bc747c072650ed287d8B on base-mainnet.
    `

const WALLET_DATA_FILE = "wallet_data.txt";

export async function initializeAgent() {
    try {
        // Initialize LLM
        const llm = new ChatOpenAI({
            model: "gpt-4o-mini",
        });

        let walletDataStr: string | null = null;

        // Read existing wallet data if available
        if (fs.existsSync(WALLET_DATA_FILE)) {
            try {
                walletDataStr = fs.readFileSync(WALLET_DATA_FILE, "utf8");
            } catch (error) {
                console.error("Error reading wallet data:", error);
                // Continue without wallet data
            }
        }

        // Configure CDP Wallet Provider
        const config = {
            apiKeyName: process.env.CDP_API_KEY_NAME,
            apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY?.replace(/\\n/g, "\n"),
            cdpWalletData: walletDataStr!,
            networkId: "base-mainnet",
        };

        const walletProvider = await CdpWalletProvider.configureWithWallet(config);

        // Initialize AgentKit
        const agentkit = await AgentKit.from({
            walletProvider,
            actionProviders: [
                wethActionProvider(),
                pythActionProvider(),
                walletActionProvider(),
                erc20ActionProvider(),
                farcasterActionProvider(),
                cdpApiActionProvider({
                    apiKeyName: process.env.CDP_API_KEY_NAME,
                    apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY?.replace(/\\n/g, "\n"),
                }),
                cdpWalletActionProvider({
                    apiKeyName: process.env.CDP_API_KEY_NAME,
                    apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY?.replace(/\\n/g, "\n"),
                }),
            ],
        });

        const tools = await getLangChainTools(agentkit);

        // Store buffered conversation history in memory
        const memory = new MemorySaver();
        const agentConfig = { configurable: { thread_id: "skynet.money Market Wizard Agent" } };

        // Create React Agent using the LLM and CDP AgentKit tools
        const agent = createReactAgent({
            llm,
            tools,
            checkpointSaver: memory,
            messageModifier: modifier,
        });

        // Save wallet data
        const exportedWallet = await walletProvider.exportWallet();
        fs.writeFileSync(WALLET_DATA_FILE, JSON.stringify(exportedWallet));

        return { agent, config: agentConfig, wallet: walletProvider };
    } catch (error) {
        console.error("Failed to initialize agent:", error);
        throw error; // Re-throw to be handled by caller
    }
}

export async function runAgent(agent, config, username: string, message: string): Promise<string> {
    const thought = `You received the following message from the user ${username} on Farcaster: ${message} \n. 
    Please reply to the user's message as the Gatekeeper. \n 
    If you decide to send $SKY tokens to the user, execute the transfer. \n
    The $SKY address on base mainnet is 0x30BAd91099D93De80550bc747c072650ed287d8B \n
    If you need the user's address ask for it. \n
    Please only respond with your message to the user and nothing else.`

    console.log(thought)

    const stream = await agent.stream({ messages: [new HumanMessage(thought)] }, config);

    let reply: string = "";

    for await (const chunk of stream) {
        if ("agent" in chunk) {
            console.log(chunk.agent.messages[0].content);
            reply = chunk.agent.messages[0].content as string;
        } else if ("tools" in chunk) {
            console.log(chunk.tools.messages[0].content);
            reply = chunk.tools.messages[0].content as string;
        }
        console.log("-------------------");
    }

    return reply;
}