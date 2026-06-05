import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

let checkpointer: PostgresSaver | null = null;
let setupPromise: Promise<void> | null = null;

export async function getDbAgentCheckpointer(): Promise<PostgresSaver> {
  if (!checkpointer) {
    const url = process.env.DATABASE_URL?.trim();
    if (!url) throw new Error("DATABASE_URL is required for agent memory");
    checkpointer = PostgresSaver.fromConnString(url);
  }
  if (!setupPromise) {
    setupPromise = checkpointer.setup().catch((e) => {
      setupPromise = null;
      throw e;
    });
  }
  await setupPromise;
  return checkpointer;
}
