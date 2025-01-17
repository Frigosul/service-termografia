export interface IGetValue {
  status: number
  resultsQty: number
  results: []
  error?: string
}

export interface IResult {
  code: string;
  name: string | null;
  values: IValue[];
}

export interface IValue {
  date: string;
  value: boolean | number | string | null;
  decimalPlaces: number;
  isInError: boolean;
  isEnabled: boolean;
  isFailPayload: boolean;
  measurementUnity?: string;
  measurementUnityId?: number;
}