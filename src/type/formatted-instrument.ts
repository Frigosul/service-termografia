type BaseInstrument = {
  id: string;
  idSitrad: number | null;
  name: string;
  model: number | null;
  type: "press" | "temp" | null;
  status: string;
  process: string | null;
  isSensorError: boolean;
  createdAt: Date;
  error: string | null;
  maxValue: number | null;
  minValue: number | null;
  setPoint: number | null;
};

type TemperatureInstrument = BaseInstrument & {
  type: "temp";
  temperature: number | null;
  differential: number | null;
};

type PressureInstrument = BaseInstrument & {
  type: "press";
  pressure: number | null;
};

export type FormattedInstrument = TemperatureInstrument | PressureInstrument;
