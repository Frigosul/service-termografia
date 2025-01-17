import { httpInstance } from "../instance";
import { IGetValue } from "../type/value-instrument";


export async function getValueInstrument(id: number): Promise<IGetValue> {

  const result = await httpInstance(`instruments/${id}/values`)
  if (result.data.error) {
    return result.data

  }

  return result.data
}