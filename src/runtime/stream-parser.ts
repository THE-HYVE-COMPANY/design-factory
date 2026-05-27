export type SubAgentStatus = "done" | "doing" | "wait" | "error";

export interface SubAgentState {
  id: string;
  name: string;
  status: SubAgentStatus;
  elapsedMs?: number;
}
