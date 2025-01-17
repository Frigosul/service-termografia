
export interface IConverter {
  id: number
  name: string
  statusId: string
  status: string
  statusDescription: string
  typeId: string
  type: string
  version: string
  communicationTimeout: number
  savePayloadInterval: number
  communicationFailInterval: number
}
export interface IConverters {
  results: IConverter[]
}