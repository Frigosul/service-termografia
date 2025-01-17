
export interface IInstrument {
  id: number;
  error?: string
  GasPressure: number
  IsErrorPressureSensor?: boolean
  converterId: number;
  name: string;
  address: number;
  statusId: number;
  status: string;
  modelId: number;
  modelVersion: number;
  IsAlarmsManuallyInhibited: boolean;
  IsSensorError: boolean;
  IsDeprogrammed: boolean;
  IsOpenDoor: boolean;
  dataloggerOn: boolean;
  IsDataloggerFull: boolean;
  IsClockDeprogrammed: boolean;
  IsAlarmOpenDoor: boolean;
  IsControlEnabled: boolean;
  hasControlsCommand: boolean;
  processTime: string;
  Temperature: number;
  IsDefrost: boolean;
  IsRefrigeration: boolean;
  IsHot: boolean;
  IsOutputFan: boolean;
  IsOutputRefr: boolean
  IsOutputDefr1: boolean
  IsErrorS1: boolean
  enableOutputRefr: boolean;
  enableOutputDefr: boolean;
  enableOutputHot: boolean;
  enableInvertStatusCommand: boolean;
  enableProcessStatusTime: boolean;
  temperatureUnityType: number;
  processStatus: number;
  setpointRelativeTemp: number;
  IsDataloggerCorrupted: boolean;
  IsManualDatalogger: boolean;
  dataloggerPercentUsage: number;
  internalRtc: string;
  fncSetpoint: number;
  fncDifferential: number;
  fncDigitalInput: number;
  remainingInhibitionTime: number | null;
  Sensor1: number
  Sensor2: number
}
export interface IInstruments {
  results: IInstrument[]
}