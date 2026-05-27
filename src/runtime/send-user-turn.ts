// send-user-turn.ts — thin re-export shim.
//
// The actual pipeline lives in `./turn-pipeline.ts`. This module
// re-exports the public surface (sendUserTurn + related types) so
// callers like EditorScreen keep importing from the historical path
// without seeing the internal three-stage (prepare → stream →
// finalize) restructure.

export {
  sendUserTurn,
  isTurnPipelineV2Enabled,
  composeUserPrompt,
  prepare,
  stream,
  finalize,
  validateTurnOutput,
  TurnAbortError,
  TurnPrepareError,
} from "./turn-pipeline";

export type {
  UserTurnInput,
  TurnResult,
  TurnContext,
  TurnStream,
  TurnSideChannels,
  TurnValidation,
  AssistantMessage,
  TurnAttachment,
  TurnMode,
  TurnStatus,
  TurnError,
  TurnExternalContext,
  ToolUseLite,
  SendUserTurnOptions,
  PrepareOptions,
  StreamOptions,
  FinalizeOptions,
} from "./turn-pipeline";
