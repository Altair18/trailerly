export interface PackPayload {
  packId: string;
}

export interface FinalPayload extends PackPayload {
  final: boolean;
}
