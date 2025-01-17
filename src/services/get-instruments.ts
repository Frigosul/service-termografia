import { httpInstance } from "../instance";
import { IInstruments } from "../type/instruments";

export async function getInstruments(): Promise<IInstruments> {

  const result = await httpInstance('instruments')

  return result.data
}